import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Optional, List

import aiohttp
from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import (
    Message,
    CallbackQuery,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    ReplyKeyboardRemove,
    BotCommand
)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# URL API бэкенда (можно переопределить через переменную окружения)
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Кэш активного пробника
active_probnik_cache: Optional[Dict] = None

# FSM состояния
class RegistrationStates(StatesGroup):
    waiting_for_fio = State()
    waiting_for_class = State()
    waiting_for_group_confirm = State()
    waiting_for_subject = State()
    waiting_for_date = State()
    waiting_for_school = State()
    waiting_for_time = State()
    waiting_for_edit_selection = State()
    waiting_for_edit_date = State()
    waiting_for_edit_school = State()
    waiting_for_edit_time = State()


# Хранение временных данных пользователей
user_data: Dict[int, Dict] = {}

# Список пользователей, ожидающих открытия записи
waiting_for_registration: set = set()

# Флаг последнего состояния пробника
last_probnik_active: bool = False


async def get_active_probnik() -> Optional[Dict]:
    """Получение активного пробника из API"""
    global active_probnik_cache
    result = await make_api_request("GET", "/telegram/active-probnik")
    if result:
        active_probnik_cache = result
    return result


def get_exam_dates_from_probnik(probnik: Dict, school: str = None) -> List[tuple]:
    """Получение дат экзаменов из пробника для конкретной школы"""
    if not probnik:
        return []
    
    # Если указана школа, используем специфичные для школы даты
    if school:
        if school == "Байкальская" and probnik.get("exam_dates_baikalskaya"):
            return [(d["label"], d["date"], d.get("times", [])) for d in probnik["exam_dates_baikalskaya"]]
        elif school == "Лермонтова" and probnik.get("exam_dates_lermontova"):
            return [(d["label"], d["date"], d.get("times", [])) for d in probnik["exam_dates_lermontova"]]
    
    # Если специфичных дат нет, используем общие
    if probnik.get("exam_dates"):
        return [(d["label"], d["date"], d.get("times", [])) for d in probnik["exam_dates"]]
    
    return []


def get_exam_times_from_probnik(probnik: Dict, school: str = None, date: str = None) -> List[str]:
    """Получение времени экзаменов из пробника для конкретной школы и даты"""
    if not probnik:
        return ["9:00", "12:00"]
    
    # Если указана дата, пытаемся получить время для этой конкретной даты
    if date:
        dates_list = None
        if school:
            if school == "Байкальская" and probnik.get("exam_dates_baikalskaya"):
                dates_list = probnik["exam_dates_baikalskaya"]
            elif school == "Лермонтова" and probnik.get("exam_dates_lermontova"):
                dates_list = probnik["exam_dates_lermontova"]
        else:
            dates_list = probnik.get("exam_dates", [])
        
        if dates_list:
            for d in dates_list:
                if d.get("date") == date and d.get("times"):
                    return d["times"]
    
    # Если указана школа, используем специфичное для школы время (fallback)
    if school:
        if school == "Байкальская" and probnik.get("exam_times_baikalskaya"):
            return probnik["exam_times_baikalskaya"]
        elif school == "Лермонтова" and probnik.get("exam_times_lermontova"):
            return probnik["exam_times_lermontova"]
    
    # Если специфичного времени нет, используем общее
    if probnik.get("exam_times"):
        return probnik["exam_times"]
    
    return ["9:00", "12:00"]


async def make_api_request(method: str, endpoint: str, data: Optional[Dict] = None) -> Optional[Dict]:
    """Выполнение HTTP запроса к API"""
    url = f"{API_BASE_URL}{endpoint}"
    async with aiohttp.ClientSession() as session:
        try:
            if method == "GET":
                async with session.get(url) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.debug(f"API GET {endpoint}: {result}")
                        return result
                    elif response.status == 404:
                        # 404 - не найдено, это нормально для некоторых запросов
                        logger.debug(f"API GET {endpoint}: 404 Not Found")
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"API GET {endpoint} error: {response.status} - {error_text}")
                        return None
            elif method == "POST":
                async with session.post(url, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.debug(f"API POST {endpoint}: {result}")
                        return result
                    elif response.status == 404:
                        logger.debug(f"API POST {endpoint}: 404 Not Found")
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"API POST {endpoint} error: {response.status} - {error_text}")
                        return None
            elif method == "PUT":
                async with session.put(url, json=data) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.debug(f"API PUT {endpoint}: {result}")
                        return result
                    elif response.status == 404:
                        logger.debug(f"API PUT {endpoint}: 404 Not Found")
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"API PUT {endpoint} error: {response.status} - {error_text}")
                        return None
            elif method == "DELETE":
                async with session.delete(url) as response:
                    if response.status == 200:
                        result = await response.json()
                        logger.debug(f"API DELETE {endpoint}: {result}")
                        return result
                    elif response.status == 404:
                        logger.debug(f"API DELETE {endpoint}: 404 Not Found")
                        return None
                    else:
                        error_text = await response.text()
                        logger.error(f"API DELETE {endpoint} error: {response.status} - {error_text}")
                        return None
        except aiohttp.ClientError as e:
            logger.error(f"API request connection error {endpoint}: {e}")
            return None
        except Exception as e:
            logger.error(f"API request error {endpoint}: {e}")
            return None
    return None


async def ensure_user_data(user_id: int) -> bool:
    """Загружает данные пользователя из базы, если их нет в user_data. Возвращает True если данные найдены."""
    if user_id in user_data:
        logger.info(f"User {user_id} data found in cache")
        return True
    
    logger.info(f"Loading user {user_id} data from database")
    # Загружаем данные из базы данных
    student_result = await make_api_request("GET", f"/telegram/student-by-user-id/{user_id}")

    if not student_result or "id" not in student_result:
        logger.warning(f"Student not found for user_id {user_id}, result: {student_result}")
        return False
    
    logger.info(f"Student found for user_id {user_id}: {student_result.get('fio')}")
    # Сохраняем данные в user_data
    user_data[user_id] = {
        "student_id": student_result["id"],
        "class_num": student_result.get("class_num"),
        "fio": student_result["fio"]
    }
    
    return True


def format_probnik_info(probnik: Optional[Dict]) -> str:
    """Форматирование информации о пробнике"""
    if not probnik:
        return ""
    
    info_lines = []
    probnik_name = probnik.get("name", "Пробник")
    info_lines.append(f"📋 Текущий пробник: {probnik_name}\n")
    

    
    return "\n".join(info_lines) + "\n" if info_lines else ""


async def start_command(message: Message, state: FSMContext):
    """Обработчик команды /start"""
    user = message.from_user
    user_id = user.id
    logger.info(f"Start command from user {user_id}")
    
    # Проверяем, есть ли активный пробник
    probnik = await get_active_probnik()
    
    # Формируем информацию о пробнике
    probnik_info = format_probnik_info(probnik)
    
    # Проверяем, есть ли уже привязанный студент
    student_result = await make_api_request("GET", f"/telegram/student-by-user-id/{user_id}")
    logger.info(f"Student lookup result for user {user_id}: {student_result is not None}")
    
    # Если студент найден, но пробник не активен
    if student_result and "id" in student_result and not probnik:
        # Добавляем в список ожидающих
        waiting_for_registration.add(user_id)
        
        await message.answer(
            f"Привет, {user.first_name}! 👋\n\n"
            f"Вы уже зарегистрированы как {student_result['fio']}.\n\n"
            "⏳ Запись на пробник пока не открыта.\n"
            "Как только откроется запись, я пришлю вам уведомление!"
        )
        await state.clear()
        return
    
    # Если студент найден (не 404 ошибка)
    if student_result and "id" in student_result:
        logger.info(f"Student found for user {user_id}: {student_result.get('fio')}, id: {student_result.get('id')}")
        # Студент уже зарегистрирован
        student_id = student_result["id"]
        class_num = student_result.get("class_num")
        fio = student_result["fio"]
        
        # Получаем текущие записи
        registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
        existing_count = len(registrations_result) if registrations_result else 0
        
        # Получаем максимальное количество записей из пробника
        max_registrations = 4  # Значение по умолчанию
        if probnik:
            max_registrations = probnik.get("max_registrations", 4)
        
        # Сохраняем данные в user_data для продолжения
        user_data[user_id] = {
            "student_id": student_id,
            "class_num": class_num,
            "fio": fio
        }
        
        if existing_count >= max_registrations:
            # Уже записался на максимальное количество экзаменов
            message_text = (
                f"Привет, {user.first_name}! 👋\n\n"
            )
            
            # Добавляем информацию о пробнике, если есть
            if probnik_info:
                message_text += probnik_info + "\n"
            
            message_text += (
                f"Вы уже зарегистрированы как {fio}.\n\n"
                "Ваши записи на экзамены:\n\n"
            )
            if registrations_result:
                for reg in registrations_result:
                    school_info = f" ({reg.get('school', 'не указана')})" if reg.get('school') else ""
                    message_text += f"• {reg['subject']} - {reg['exam_date']} в {reg['exam_time']}{school_info}\n"
            message_text += f"\nВы уже записались на максимальное количество экзаменов ({max_registrations})."
            
            await message.answer(message_text)
            await state.clear()
            return
        else:
            # Можно еще записаться
            message_text = (
                f"Привет, {user.first_name}! 👋\n\n"
            )
            
            # Добавляем информацию о пробнике, если есть
            if probnik_info:
                message_text += probnik_info + "\n"
            
            message_text += (
                f"Вы уже зарегистрированы как {fio}.\n"
                f"У вас записано экзаменов: {existing_count}/{max_registrations}\n\n"
                "Хотите записаться еще на экзамен?"
            )
            
            keyboard = [
                [InlineKeyboardButton(text="Да, записаться", callback_data="continue_registration")],
                [InlineKeyboardButton(text="Посмотреть мои записи", callback_data="view_registrations")]
            ]
            reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
            
            await message.answer(message_text, reply_markup=reply_markup)
            await state.clear()
            return
    
    # Новый пользователь - показываем приветствие
    welcome_message = (
        f"Привет, {user.first_name}! 👋\n\n"
    )
    
    # Добавляем информацию о пробнике, если есть
    if probnik_info:
        welcome_message += probnik_info + "\n"
    
    welcome_message += (
        "Это бот школы Гарри, который поможет вам записаться на пробник.\n\n"
        "Я помогу вам:\n"
        "• Найти вашу запись в базе данных\n"
        "• Выбрать предметы для экзамена\n"
        "• Записаться на удобное время\n\n"
        "Готовы начать?"
    )
    
    keyboard = [[InlineKeyboardButton(text="Записаться", callback_data="register")]]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    
    await message.answer(welcome_message, reply_markup=reply_markup)
    await state.clear()


async def register_callback(callback: CallbackQuery, state: FSMContext):
    """Обработчик кнопки 'Записаться'"""
    await callback.answer()
    
    user_id = callback.from_user.id
    user_data[user_id] = {}
    
    await callback.message.edit_text(
        "Для начала мне нужно найти вас в базе данных.\n\n"
        "Пожалуйста, введите вашу Фамилию и Имя (например: Иванов Иван):"
    )
    
    await state.set_state(RegistrationStates.waiting_for_fio)


async def handle_fio(message: Message, state: FSMContext):
    """Обработка ввода ФИО"""
    user_id = message.from_user.id
    fio = message.text.strip()
    
    if not fio or len(fio) < 3:
        await message.answer("Пожалуйста, введите корректное ФИО (минимум 3 символа).")
        return
    
    user_data[user_id]["fio"] = fio
    
    # Поиск ученика в базе данных
    result = await make_api_request("POST", "/telegram/search-student", {"fio": fio})
    
    if not result or len(result) == 0:
        # Если ученик не найден, создаем нового
        # Парсим ФИО для извлечения фамилии и имени
        fio_parts = fio.strip().split()
        if len(fio_parts) < 2:
            await message.answer(
                "Пожалуйста, введите Фамилию и Имя (например: Иванов Иван)."
            )
            return
        
        # Создаем нового ученика
        new_student_result = await make_api_request("POST", "/students/", {
            "fio": fio,
            "class_num": None,
            "user_id": None
        })
        
        if not new_student_result or "id" not in new_student_result:
            await message.answer(
                "Ошибка при создании нового ученика. Пожалуйста, попробуйте еще раз или обратитесь к администратору."
            )
            await state.clear()
            return
        
        # Используем созданного ученика
        student_id = new_student_result["id"]
        user_data[user_id]["student_id"] = student_id
        user_data[user_id]["class_num"] = new_student_result.get("class_num")
        
        # Показываем выбор класса
        await message.answer(
            f"Я создал новую запись для вас:\n\n"
            f"ФИО: {fio}\n\n"
            "Пожалуйста, выберите ваш класс:"
        )
        
        keyboard = [
            [InlineKeyboardButton(text="9 класс", callback_data="class_9")],
            [InlineKeyboardButton(text="10 класс", callback_data="class_10")],
            [InlineKeyboardButton(text="11 класс", callback_data="class_11")]
        ]
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        await message.answer("Выберите класс:", reply_markup=reply_markup)
        await state.set_state(RegistrationStates.waiting_for_class)
        return
    
    if len(result) == 1:
        # Один результат - показываем для подтверждения
        student = result[0]
        user_data[user_id]["student_id"] = student["id"]
        user_data[user_id]["class_num"] = student.get("class_num")
        
        await message.answer(
            f"Отлично! Я нашел вас в базе данных.\n\n"
            f"ФИО: {student['fio']}\n"
            f"Класс: {student.get('class_num', 'не указан')}\n"
            f"Группы: {', '.join(student.get('groups', []))}\n\n"
            "Правильно?"
        )
        
        keyboard = [
            [InlineKeyboardButton(text="Да, правильно", callback_data="confirm_student")],
            [InlineKeyboardButton(text="Нет, это не я", callback_data="create_new_student")]
        ]
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        await message.answer("Подтвердите:", reply_markup=reply_markup)
        await state.set_state(RegistrationStates.waiting_for_group_confirm)
    else:
        # Несколько результатов - показываем список
        user_data[user_id]["search_results"] = result
        message_text = "Найдено несколько учеников. Выберите правильного:\n\n"
        keyboard = []
        for idx, student in enumerate(result):
            
            keyboard.append([InlineKeyboardButton(
                text=f"{student['fio']}",
                callback_data=f"select_student_{student['id']}"
            )])
        
        # Добавляем кнопку "Меня нет в списке"
        keyboard.append([InlineKeyboardButton(
            text="Меня нет в списке",
            callback_data="create_new_student"
        )])
        
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        await message.answer(message_text, reply_markup=reply_markup)
        await state.set_state(RegistrationStates.waiting_for_group_confirm)


async def handle_student_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора студента из списка"""
    await callback.answer()
    
    user_id = callback.from_user.id
    student_id = int(callback.data.split("_")[-1])
    
    # Находим выбранного студента
    results = user_data[user_id].get("search_results", [])
    selected_student = next((s for s in results if s["id"] == student_id), None)
    
    if not selected_student:
        await callback.message.edit_text("Ошибка: студент не найден.")
        await state.clear()
        return
    
    user_data[user_id]["student_id"] = student_id
    user_data[user_id]["class_num"] = selected_student.get("class_num")
    
    # Показываем информацию и просим подтвердить
    await callback.message.edit_text(
        f"Отлично! Вы выбрали:\n\n"
        f"ФИО: {selected_student['fio']}\n"
        f"Класс: {selected_student.get('class_num', 'не указан')}\n\n"
        "Правильно?"
    )
    
    keyboard = [
        [InlineKeyboardButton(text="Да, правильно", callback_data="confirm_student")],
        [InlineKeyboardButton(text="Нет, это не я", callback_data="create_new_student")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.answer("Подтвердите:", reply_markup=reply_markup)
    await state.set_state(RegistrationStates.waiting_for_group_confirm)


async def create_new_student_callback(callback: CallbackQuery, state: FSMContext):
    """Обработка создания нового ученика с указанным ФИО"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Получаем ФИО из user_data
    fio = user_data.get(user_id, {}).get("fio")
    
    if not fio:
        await callback.message.edit_text("Ошибка: ФИО не найдено. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Парсим ФИО для проверки
    fio_parts = fio.strip().split()
    if len(fio_parts) < 2:
        await callback.message.edit_text(
            "Пожалуйста, введите Фамилию и Имя (например: Иванов Иван)."
        )
        await state.set_state(RegistrationStates.waiting_for_fio)
        return
    
    # Создаем нового ученика
    new_student_result = await make_api_request("POST", "/students/", {
        "fio": fio,
        "class_num": None,
        "user_id": None
    })
    
    if not new_student_result or "id" not in new_student_result:
        await callback.message.edit_text(
            "Ошибка при создании нового ученика. Пожалуйста, попробуйте еще раз или обратитесь к администратору."
        )
        await state.clear()
        return
    
    # Используем созданного ученика
    student_id = new_student_result["id"]
    user_data[user_id]["student_id"] = student_id
    user_data[user_id]["class_num"] = new_student_result.get("class_num")
    
    # Показываем выбор класса
    await callback.message.edit_text(
        f"Я создал новую запись для вас:\n\n"
        f"ФИО: {fio}\n\n"
        "Пожалуйста, выберите ваш класс:"
    )
    
    keyboard = [
        [InlineKeyboardButton(text="9 класс", callback_data="class_9")],
        [InlineKeyboardButton(text="10 класс", callback_data="class_10")],
        [InlineKeyboardButton(text="11 класс", callback_data="class_11")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.answer("Выберите класс:", reply_markup=reply_markup)
    await state.set_state(RegistrationStates.waiting_for_class)


async def handle_class_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора класса"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Получаем выбранный класс из callback_data
    class_num = int(callback.data.replace("class_", ""))
    
    # Проверяем, что класс валидный
    if class_num not in [9, 10, 11]:
        await callback.message.edit_text("Ошибка: некорректный класс. Пожалуйста, выберите класс заново.")
        return
    
    # Получаем student_id из user_data
    student_id = user_data.get(user_id, {}).get("student_id")
    
    if not student_id:
        await callback.message.edit_text("Ошибка: данные студента не найдены. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Обновляем класс студента в базе данных
    update_result = await make_api_request("PUT", f"/students/{student_id}", {
        "class_num": class_num
    })
    
    if not update_result:
        await callback.message.edit_text("Ошибка при обновлении класса. Пожалуйста, попробуйте еще раз.")
        return
    
    # Сохраняем class_num в user_data
    if user_id in user_data:
        user_data[user_id]["class_num"] = class_num
    
    await callback.message.edit_text(
        f"Отлично! Выбран класс: {class_num}\n\n"
        "Продолжаем регистрацию?"
    )
    
    keyboard = [
        [InlineKeyboardButton(text="Да, продолжить", callback_data="confirm_student")],
        [InlineKeyboardButton(text="Нет, отменить", callback_data="cancel")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.answer("Подтвердите:", reply_markup=reply_markup)
    await state.set_state(RegistrationStates.waiting_for_group_confirm)


async def confirm_student_callback(callback: CallbackQuery, state: FSMContext):
    """Обработка подтверждения студента"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Проверяем, есть ли данные студента в user_data
    student_id = user_data.get(user_id, {}).get("student_id")
    
    if not student_id:
        # Пытаемся загрузить данные из базы данных
        if not await ensure_user_data(user_id):
            await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
            await state.clear()
            return
        student_id = user_data[user_id].get("student_id")
    
    if not student_id:
        await callback.message.edit_text("Ошибка: данные студента не найдены.")
        await state.clear()
        return
    
    # Подтверждаем студента (привязываем user_id)
    confirm_result = await make_api_request("POST", "/telegram/confirm-student", {
        "student_id": student_id,
        "user_id": user_id
    })
    
    if not confirm_result:
        logger.error(f"Failed to confirm student {student_id} for user {user_id}")
        await callback.message.edit_text("Ошибка при подтверждении студента. Пожалуйста, попробуйте еще раз.")
        await state.clear()
        return
    
    logger.info(f"Student {student_id} confirmed for user {user_id}")
    
    # Обновляем user_data с данными из confirm_result (может содержать class_num)
    if user_id in user_data:
        user_data[user_id]["student_id"] = student_id
        if confirm_result.get("class_num"):
            user_data[user_id]["class_num"] = confirm_result.get("class_num")
    
    # Проверяем, есть ли активный пробник
    probnik = await get_active_probnik()
    if not probnik:
        await callback.message.edit_text(
            "✅ Отлично! Вы успешно зарегистрированы.\n\n"
            "⏳ Запись на пробник пока не открыта.\n\n"
            "Как только откроется запись, я пришлю вам уведомление!"
        )
        waiting_for_registration.add(user_id)
        await state.clear()
        return
    
    await callback.message.edit_text("Отлично! Теперь выберите предмет для экзамена.")
    
    await show_subjects(callback.message, state, user_id=user_id)


async def show_subjects(message_or_callback, state: FSMContext, user_id: Optional[int] = None):
    """Показ списка предметов"""
    # Если user_id передан явно, используем его
    if user_id is None:
        if isinstance(message_or_callback, CallbackQuery):
            user_id = message_or_callback.from_user.id
        elif isinstance(message_or_callback, Message):
            user_id = message_or_callback.from_user.id
        else:
            user_id = message_or_callback.chat.id
    
    logger.info(f"show_subjects called for user_id: {user_id}")
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        message_text = "Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start"
        if isinstance(message_or_callback, CallbackQuery):
            await message_or_callback.message.edit_text(message_text)
        else:
            await message_or_callback.answer(message_text)
        await state.clear()
        return
    
    class_num = user_data[user_id].get("class_num")
    
    if not class_num:
        message_text = "Класс не указан. Пожалуйста, обратитесь к администратору."
        if isinstance(message_or_callback, CallbackQuery):
            await message_or_callback.message.edit_text(message_text)
        else:
            await message_or_callback.answer(message_text)
        await state.clear()
        return
    
    # Получаем список предметов
    result = await make_api_request("GET", f"/telegram/subjects/{class_num}")
    
    if not result:
        message_text = "Ошибка при получении списка предметов."
        if isinstance(message_or_callback, CallbackQuery):
            await message_or_callback.message.edit_text(message_text)
        else:
            await message_or_callback.answer(message_text)
        await state.clear()
        return
    
    subjects = result.get("subjects", [])
    
    # Проверяем, сколько экзаменов уже записано
    student_id = user_data[user_id].get("student_id")
    if not student_id:
        message_text = "Ошибка: ID студента не найден. Пожалуйста, начните регистрацию заново."
        if isinstance(message_or_callback, CallbackQuery):
            await message_or_callback.message.edit_text(message_text)
        else:
            await message_or_callback.answer(message_text)
        await state.clear()
        return
    
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    existing_count = len(registrations_result) if registrations_result else 0
    
    # Получаем максимальное количество записей из пробника
    probnik = await get_active_probnik()
    max_registrations = 4  # Значение по умолчанию
    if probnik:
        max_registrations = probnik.get("max_registrations", 4)
    
    if existing_count >= max_registrations:
        message_text = f"Вы уже записались на {max_registrations} экзаменов. Это максимальное количество."
        if isinstance(message_or_callback, CallbackQuery):
            await message_or_callback.message.edit_text(message_text)
        else:
            await message_or_callback.answer(message_text)
        await state.clear()
        return
    
    # Получаем список уже записанных предметов
    registered_subjects = set()
    if registrations_result:
        for reg in registrations_result:
            registered_subjects.add(reg.get("subject"))
    
    message_text = f"Выберите предмет для экзамена ({existing_count}/4):\n\n"
    keyboard = []
    for subject in subjects:
        if subject in registered_subjects:
            # Предмет уже выбран - добавляем галочку и делаем callback неактивным
            keyboard.append([InlineKeyboardButton(
                text=f"✅ {subject}",
                callback_data=f"subject_already_selected_{subject}"
            )])
        else:
            keyboard.append([InlineKeyboardButton(text=subject, callback_data=f"subject_{subject}")])
    
    keyboard.append([InlineKeyboardButton(text="Завершить регистрацию", callback_data="finish_registration")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    
    if isinstance(message_or_callback, CallbackQuery):
        await message_or_callback.message.edit_text(message_text, reply_markup=reply_markup)
    else:
        await message_or_callback.answer(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_subject)


async def handle_subject_already_selected(callback: CallbackQuery, state: FSMContext):
    """Обработка попытки выбрать уже выбранный предмет"""
    await callback.answer("Этот предмет уже выбран", show_alert=True)
    
    # Показываем список предметов снова
    user_id = callback.from_user.id
    await show_subjects(callback.message, state, user_id=user_id)


async def handle_subject_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора предмета"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    subject = callback.data.replace("subject_", "")
    
    # Проверяем, не выбран ли уже этот предмет
    student_id = user_data[user_id].get("student_id")
    if student_id:
        registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
        if registrations_result:
            registered_subjects = [reg.get("subject") for reg in registrations_result]
            if subject in registered_subjects:
                await callback.answer("Этот предмет уже выбран", show_alert=True)
                await show_subjects(callback.message, state, user_id=user_id)
                return
    
    user_data[user_id]["current_subject"] = subject
    
    # Показываем выбор школы (сначала выбираем школу, потом даты)
    message_text = f"Вы выбрали: {subject}\n\nВыберите школу:"
    keyboard = [
        [InlineKeyboardButton(text="Лермонтова", callback_data="school_Лермонтова")],
        [InlineKeyboardButton(text="Байкальская", callback_data="school_Байкальская")]
    ]
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_subjects")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_school)


async def handle_date_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора даты - показываем время для выбранной школы"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    date = callback.data.replace("date_", "")
    user_data[user_id]["current_date"] = date
    
    school = user_data[user_id].get("current_school")
    if not school:
        await callback.message.edit_text("Ошибка: школа не выбрана. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    student_id = user_data[user_id].get("student_id")
    if not student_id:
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Получаем существующие записи для проверки занятых времен
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    
    # Проверяем доступные слоты с учетом школы
    slots_result = await make_api_request("GET", f"/telegram/available-slots/{date}?school={school}")
    
    # Получаем времена из пробника для выбранной школы и даты
    probnik = await get_active_probnik()
    exam_times = get_exam_times_from_probnik(probnik, school, date)
    
    message_text = f"Вы выбрали дату: {date}\nШкола: {school}\n\nВыберите время экзамена:"
    keyboard = []
    
    # Проверяем, есть ли уже записи на эту дату и время для данного ученика
    existing_registrations = {}
    if registrations_result:
        for reg in registrations_result:
            reg_date = reg.get("exam_date", "")
            reg_time = reg.get("exam_time", "")
            reg_school = reg.get("school", "")
            # Нормализуем дату для сравнения (может быть в разных форматах)
            if reg_date:
                # Если дата содержит время, берем только дату
                if "T" in reg_date:
                    reg_date = reg_date.split("T")[0]
                # Сравниваем даты
                if reg_date == date and reg_school == school:
                    existing_registrations[reg_time] = True
    
    if slots_result:
        slots = slots_result.get("slots", {})
        for time in exam_times:
            # Проверяем, есть ли уже запись на это время
            has_registration = existing_registrations.get(time, False)
            
            slot_info = slots.get(time, {})
            available = slot_info.get("available", 0)
            
            if has_registration:
                # Показываем галочку для уже записанного времени
                keyboard.append([InlineKeyboardButton(
                    text=f"✅ {time} (уже записан)",
                    callback_data="time_already_booked"
                )])
            elif available > 0:
                keyboard.append([InlineKeyboardButton(
                    text=f"{time} (свободно: {available})",
                    callback_data=f"time_{time}"
                )])
            else:
                keyboard.append([InlineKeyboardButton(
                    text=f"{time} (занято)",
                    callback_data="time_full"
                )])
    else:
        for time in exam_times:
            # Проверяем, есть ли уже запись на это время
            has_registration = existing_registrations.get(time, False)
            
            if has_registration:
                # Показываем галочку для уже записанного времени
                keyboard.append([InlineKeyboardButton(
                    text=f"✅ {time} (уже записан)",
                    callback_data="time_already_booked"
                )])
            else:
                keyboard.append([InlineKeyboardButton(text=time, callback_data=f"time_{time}")])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_dates")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_time)


async def handle_date_already_booked(callback: CallbackQuery, state: FSMContext):
    """Обработка попытки выбрать уже забронированную дату"""
    await callback.answer("У вас уже есть запись на этот день. Выберите другой день.", show_alert=True)


async def handle_time_already_booked(callback: CallbackQuery, state: FSMContext):
    """Обработка попытки выбрать уже забронированное время"""
    await callback.answer("У вас уже есть запись на это время в этот день. Выберите другое время.", show_alert=True)


async def back_to_subjects_callback(callback: CallbackQuery, state: FSMContext):
    """Возврат к выбору предмета"""
    await callback.answer()
    
    user_id = callback.from_user.id
    await show_subjects(callback.message, state, user_id=user_id)


async def back_to_dates_callback(callback: CallbackQuery, state: FSMContext):
    """Возврат к выбору даты для выбранной школы"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    subject = user_data[user_id].get("current_subject")
    school = user_data[user_id].get("current_school")
    
    if not subject or not school:
        await callback.message.edit_text("Ошибка: предмет или школа не выбраны. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Получаем даты из пробника для выбранной школы
    probnik = await get_active_probnik()
    exam_dates = get_exam_dates_from_probnik(probnik, school)
    
    if not exam_dates:
        await callback.message.edit_text(f"Ошибка: даты экзаменов для школы '{school}' не настроены. Обратитесь к администратору.")
        await state.clear()
        return
    
    # Показываем доступные даты для выбранной школы
    message_text = f"Вы выбрали: {subject}\nШкола: {school}\n\nВыберите дату экзамена:"
    keyboard = []
    for date_item in exam_dates:
        if len(date_item) >= 2:
            date_label = date_item[0]
            date_value = date_item[1]
        else:
            continue
        # Форматируем дату для отображения
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date_value, "%Y-%m-%d")
            formatted_date = date_obj.strftime("%d.%m.%Y")
        except:
            formatted_date = date_value
        display_text = f"{date_label} ({formatted_date})"
        keyboard.append([InlineKeyboardButton(text=display_text, callback_data=f"date_{date_value}")])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_schools")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_date)


async def back_to_school_callback(callback: CallbackQuery, state: FSMContext):
    """Возврат к выбору школы"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    subject = user_data[user_id].get("current_subject")
    if not subject:
        await callback.message.edit_text("Ошибка: предмет не выбран. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Показываем выбор школы
    message_text = f"Вы выбрали: {subject}\n\nВыберите школу:"
    keyboard = [
        [InlineKeyboardButton(text="Лермонтова", callback_data="school_Лермонтова")],
        [InlineKeyboardButton(text="Байкальская", callback_data="school_Байкальская")]
    ]
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_subjects")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_school)


async def back_to_schools_callback(callback: CallbackQuery, state: FSMContext):
    """Возврат к выбору школы (алиас для back_to_school)"""
    await back_to_school_callback(callback, state)


async def handle_school_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора школы - показываем даты для выбранной школы"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    school = callback.data.replace("school_", "")
    user_data[user_id]["current_school"] = school
    
    subject = user_data[user_id].get("current_subject")
    if not subject:
        await callback.message.edit_text("Ошибка: предмет не выбран. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Получаем даты из пробника для выбранной школы
    probnik = await get_active_probnik()
    exam_dates = get_exam_dates_from_probnik(probnik, school)
    
    if not exam_dates:
        await callback.message.edit_text(f"Ошибка: даты экзаменов для школы '{school}' не настроены. Обратитесь к администратору.")
        await state.clear()
        return
    
    # Показываем доступные даты для выбранной школы
    message_text = f"Вы выбрали: {subject}\nШкола: {school}\n\nВыберите дату экзамена:"
    keyboard = []
    for date_item in exam_dates:
        if len(date_item) >= 2:
            date_label = date_item[0]
            date_value = date_item[1]
        else:
            continue
        # Форматируем дату для отображения (2026-01-05 -> 05.01.2026)
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date_value, "%Y-%m-%d")
            formatted_date = date_obj.strftime("%d.%m.%Y")
        except:
            formatted_date = date_value
        display_text = f"{date_label} ({formatted_date})"
        keyboard.append([InlineKeyboardButton(text=display_text, callback_data=f"date_{date_value}")])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_schools")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_date)


async def handle_time_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора времени"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    if callback.data == "time_full":
        await callback.message.edit_text("Это время занято. Выберите другое время.")
        return
    
    time = callback.data.replace("time_", "")
    
    student_id = user_data[user_id].get("student_id")
    subject = user_data[user_id].get("current_subject")
    date = user_data[user_id].get("current_date")
    school = user_data[user_id].get("current_school")
    
    if not student_id or not subject or not date or not school:
        await callback.message.edit_text("Ошибка: неполные данные. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Проверяем, есть ли уже запись на эту дату и время
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    if registrations_result:
        for reg in registrations_result:
            reg_date = reg.get("exam_date", "")
            reg_time = reg.get("exam_time", "")
            reg_school = reg.get("school", "")
            # Нормализуем дату для сравнения
            if reg_date:
                if "T" in reg_date:
                    reg_date = reg_date.split("T")[0]
            if reg_date == date and reg_time == time and reg_school == school:
                # Уже есть запись на эту дату и время
                await callback.answer("У вас уже есть запись на это время в этот день. Выберите другое время.", show_alert=True)
                # Возвращаем к выбору времени с галочками
                slots_result = await make_api_request("GET", f"/telegram/available-slots/{date}?school={school}")
                probnik = await get_active_probnik()
                exam_times = get_exam_times_from_probnik(probnik, school, date)
                message_text = f"Вы выбрали дату: {date}\nШкола: {school}\n\nВыберите время экзамена:"
                keyboard = []
                
                # Создаем словарь существующих записей
                existing_registrations = {}
                for r in registrations_result:
                    r_date = r.get("exam_date", "")
                    if r_date:
                        if "T" in r_date:
                            r_date = r_date.split("T")[0]
                    if r_date == date and r.get("school") == school:
                        existing_registrations[r.get("exam_time")] = True
                
                if slots_result:
                    slots = slots_result.get("slots", {})
                    for time_option in exam_times:
                        has_registration = existing_registrations.get(time_option, False)
                        slot_info = slots.get(time_option, {})
                        available = slot_info.get("available", 0)
                        
                        if has_registration:
                            keyboard.append([InlineKeyboardButton(
                                text=f"✅ {time_option} (уже записан)",
                                callback_data="time_already_booked"
                            )])
                        elif available > 0:
                            keyboard.append([InlineKeyboardButton(
                                text=f"{time_option} (свободно: {available})",
                                callback_data=f"time_{time_option}"
                            )])
                        else:
                            keyboard.append([InlineKeyboardButton(
                                text=f"{time_option} (занято)",
                                callback_data="time_full"
                            )])
                else:
                    for time_option in exam_times:
                        has_registration = existing_registrations.get(time_option, False)
                        if has_registration:
                            keyboard.append([InlineKeyboardButton(
                                text=f"✅ {time_option} (уже записан)",
                                callback_data="time_already_booked"
                            )])
                        else:
                            keyboard.append([InlineKeyboardButton(text=time_option, callback_data=f"time_{time_option}")])
                
                keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_dates")])
                reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
                await callback.message.edit_text(message_text, reply_markup=reply_markup)
                return
    
    # Регистрируем на экзамен
    result = await make_api_request("POST", "/telegram/register-exam", {
        "student_id": student_id,
        "subject": subject,
        "exam_date": date,
        "exam_time": time,
        "school": school
    })
    
    if result:
        await callback.message.edit_text(
            f"✅ Отлично! Вы успешно записались на экзамен:\n\n"
            f"Предмет: {subject}\n"
            f"Дата: {date}\n"
            f"Время: {time}\n"
            f"Школа: {school}\n\n"
            "Хотите записаться еще на один экзамен?"
        )
        
        keyboard = [
            [InlineKeyboardButton(text="Да, записаться еще", callback_data="register_more")],
            [InlineKeyboardButton(text="Нет, завершить", callback_data="finish_registration")]
        ]
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        await callback.message.answer("Выберите действие:", reply_markup=reply_markup)
    else:
        await callback.message.edit_text(
            "Ошибка при записи на экзамен. Возможно, все места заняты или вы уже записались на этот экзамен."
        )
    
    await state.set_state(RegistrationStates.waiting_for_subject)


async def register_more_callback(callback: CallbackQuery, state: FSMContext):
    """Обработка кнопки 'Записаться еще'"""
    await callback.answer()
    
    user_id = callback.from_user.id
    await show_subjects(callback.message, state, user_id=user_id)

async def continue_registration_callback(callback: CallbackQuery, state: FSMContext):
    """Обработка кнопки 'Продолжить регистрацию'"""
    await callback.answer()
    
    user_id = callback.from_user.id
    logger.info(f"Continue registration requested by user {user_id}")
    
    # Проверяем, есть ли активный пробник
    probnik = await get_active_probnik()
    if not probnik:
        await callback.message.edit_text(
            "⏳ Запись на пробник пока не открыта.\n\n"
            "Как только откроется запись, я пришлю вам уведомление!"
        )
        waiting_for_registration.add(user_id)
        await state.clear()
        return
    
    # Проверяем, есть ли данные в user_data (они могли быть сохранены в start_command)
    if user_id in user_data and user_data[user_id].get("student_id"):
        logger.info(f"User {user_id} data found in cache, using cached data")
        # Убеждаемся, что user_id сохранен в базе
        student_id = user_data[user_id].get("student_id")
        # Проверяем, что студент существует в базе с этим user_id
        student_result = await make_api_request("GET", f"/telegram/student-by-user-id/{user_id}")
        if not student_result or student_result.get("id") != student_id:
            # user_id не сохранен в базе, сохраняем его
            logger.info(f"Saving user_id {user_id} for student {student_id}")
            confirm_result = await make_api_request("POST", "/telegram/confirm-student", {
                "student_id": student_id,
                "user_id": user_id
            })
            if not confirm_result:
                logger.error(f"Failed to save user_id {user_id} for student {student_id}")
                await callback.message.edit_text(
                    "Ошибка: не удалось сохранить данные. "
                    "Пожалуйста, начните регистрацию заново с команды /start"
                )
                await state.clear()
                return
            else:
                logger.info(f"Successfully saved user_id {user_id} for student {student_id}")
    else:
        # Загружаем данные из базы данных
        if not await ensure_user_data(user_id):
            logger.error(f"Failed to load user data for user_id {user_id}")
            # Если данные не найдены, но были в user_data ранее, возможно они потерялись
            # Пробуем найти студента по другим признакам (если есть незавершенная регистрация)
            if user_id in user_data and user_data[user_id].get("student_id"):
                student_id = user_data[user_id].get("student_id")
                logger.info(f"Trying to save user_id {user_id} for student {student_id} from cache")
                confirm_result = await make_api_request("POST", "/telegram/confirm-student", {
                    "student_id": student_id,
                    "user_id": user_id
                })
                if confirm_result:
                    logger.info(f"Successfully saved user_id {user_id} for student {student_id}")
                    # Теперь данные должны быть в базе, пробуем еще раз
                    if await ensure_user_data(user_id):
                        logger.info(f"User {user_id} data loaded after saving user_id")
                    else:
                        await callback.message.edit_text(
                            "Ошибка: не удалось загрузить данные студента. "
                            "Пожалуйста, начните регистрацию заново с команды /start"
                        )
                        await state.clear()
                        return
                else:
                    await callback.message.edit_text(
                        "Ошибка: не удалось сохранить данные. "
                        "Пожалуйста, начните регистрацию заново с команды /start"
                    )
                    await state.clear()
                    return
            else:
                await callback.message.edit_text(
                    "Ошибка: студент не найден в базе данных. "
                    "Возможно, вы еще не завершили регистрацию или произошла ошибка. "
                    "Пожалуйста, начните регистрацию заново с команды /start"
                )
                await state.clear()
                return
    
    logger.info(f"User {user_id} data loaded successfully, showing subjects")
    await show_subjects(callback.message, state, user_id=user_id)

async def view_registrations_callback(callback: CallbackQuery, state: FSMContext):
    """Обработка кнопки 'Посмотреть мои записи'"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    student_id = user_data[user_id].get("student_id")
    
    if not student_id:
        await callback.message.edit_text("Ошибка: ID студента не найден.")
        await state.clear()
        return
    
    # Получаем активный пробник для получения max_registrations
    probnik = await get_active_probnik()
    max_registrations = 4  # Значение по умолчанию
    if probnik:
        max_registrations = probnik.get("max_registrations", 4)
    
    # Получаем записи (уже отфильтрованные по активному пробнику в backend)
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    
    if registrations_result:
        message_text = "Ваши записи на экзамены:\n\n"
        for reg in registrations_result:
            school_info = f" ({reg.get('school', 'не указана')})" if reg.get('school') else ""
            message_text += f"• {reg['subject']} - {reg['exam_date']} в {reg['exam_time']}{school_info}\n"
        message_text += f"\nВсего записей: {len(registrations_result)}/{max_registrations}"
    else:
        message_text = "У вас пока нет записей на экзамены."
    
    keyboard = [
        [InlineKeyboardButton(text="Записаться еще", callback_data="continue_registration")],
        [InlineKeyboardButton(text="Изменить запись", callback_data="edit_registration")],
        [InlineKeyboardButton(text="Назад", callback_data="back_to_start")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    await state.clear()


async def edit_registration_callback(callback: CallbackQuery, state: FSMContext):
    """Обработка кнопки 'Изменить запись'"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    student_id = user_data[user_id].get("student_id")
    
    if not student_id:
        await callback.message.edit_text("Ошибка: ID студента не найден.")
        await state.clear()
        return
    
    # Получаем все записи
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    
    if not registrations_result:
        await callback.message.edit_text("У вас нет записей для изменения.")
        await state.clear()
        return
    
    message_text = "Выберите запись для изменения:\n\n"
    keyboard = []
    
    for reg in registrations_result:
        school_info = f" ({reg.get('school', '')})" if reg.get('school') else ""
        button_text = f"{reg['subject']} - {reg['exam_date']} {reg['exam_time']}{school_info}"
        keyboard.append([InlineKeyboardButton(
            text=button_text,
            callback_data=f"edit_reg_{reg['id']}"
        )])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="view_registrations")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    await state.set_state(RegistrationStates.waiting_for_edit_selection)


async def handle_edit_registration_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора записи для редактирования"""
    await callback.answer()
    
    user_id = callback.from_user.id
    registration_id = int(callback.data.replace("edit_reg_", ""))
    
    # Загружаем данные из базы данных
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    student_id = user_data[user_id].get("student_id")
    
    # Получаем информацию о записи
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    current_reg = None
    if registrations_result:
        for reg in registrations_result:
            if reg['id'] == registration_id:
                current_reg = reg
                break
    
    if not current_reg:
        await callback.message.edit_text("Запись не найдена.")
        await state.clear()
        return
    
    # Сохраняем данные редактируемой записи
    user_data[user_id]["edit_registration_id"] = registration_id
    user_data[user_id]["edit_subject"] = current_reg['subject']
    
    school_info = f" ({current_reg.get('school', '')})" if current_reg.get('school') else ""
    message_text = (
        f"Редактирование записи:\n\n"
        f"Предмет: {current_reg['subject']}\n"
        f"Дата: {current_reg['exam_date']}\n"
        f"Время: {current_reg['exam_time']}{school_info}\n\n"
        "Что вы хотите сделать?"
    )
    
    keyboard = [
        [InlineKeyboardButton(text="Изменить дату/время/школу", callback_data="edit_change_datetime")],
        [InlineKeyboardButton(text="🗑 Удалить запись", callback_data=f"delete_reg_{registration_id}")],
        [InlineKeyboardButton(text="◀️ Назад", callback_data="edit_registration")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    
    await callback.message.edit_text(message_text, reply_markup=reply_markup)


async def handle_edit_change_datetime(callback: CallbackQuery, state: FSMContext):
    """Изменение даты/времени записи - сначала выбираем школу"""
    await callback.answer()
    
    user_id = callback.from_user.id
    subject = user_data[user_id].get("edit_subject", "экзамен")
    
    # Показываем выбор школы
    message_text = f"Выберите школу для {subject}:"
    keyboard = [
        [InlineKeyboardButton(text="Лермонтова", callback_data="edit_school_Лермонтова")],
        [InlineKeyboardButton(text="Байкальская", callback_data="edit_school_Байкальская")]
    ]
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data=f"edit_reg_{user_data[user_id].get('edit_registration_id')}")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_edit_school)


async def handle_edit_date_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора новой даты при редактировании - показываем время для выбранной школы"""
    await callback.answer()
    
    user_id = callback.from_user.id
    date = callback.data.replace("edit_date_", "")
    
    user_data[user_id]["edit_new_date"] = date
    
    school = user_data[user_id].get("edit_new_school")
    if not school:
        await callback.message.edit_text("Ошибка: школа не выбрана. Пожалуйста, начните редактирование заново.")
        await state.clear()
        return
    
    # Получаем времена из пробника для выбранной школы и даты
    probnik = await get_active_probnik()
    exam_times = get_exam_times_from_probnik(probnik, school, date)
    
    # Получаем существующие записи для проверки занятых времен
    registration_id = user_data[user_id].get("edit_registration_id")
    student_id = user_data[user_id].get("student_id")
    existing_registrations = {}
    
    if student_id:
        registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
        if registrations_result:
            for reg in registrations_result:
                # Пропускаем текущую редактируемую запись
                if reg.get("id") == registration_id:
                    continue
                reg_date = reg.get("exam_date", "")
                reg_time = reg.get("exam_time", "")
                reg_school = reg.get("school", "")
                # Нормализуем дату для сравнения
                if reg_date:
                    if "T" in reg_date:
                        reg_date = reg_date.split("T")[0]
                    if reg_date == date and reg_school == school:
                        existing_registrations[reg_time] = True
    
    # Показываем выбор времени
    message_text = f"Вы выбрали дату: {date}\nШкола: {school}\n\nВыберите время:"
    keyboard = []
    
    # Проверяем доступные слоты с учетом школы
    slots_result = await make_api_request("GET", f"/telegram/available-slots/{date}?school={school}")
    
    if slots_result:
        slots = slots_result.get("slots", {})
        for time in exam_times:
            # Проверяем, есть ли уже запись на это время
            has_registration = existing_registrations.get(time, False)
            
            slot_info = slots.get(time, {})
            available = slot_info.get("available", 0)
            
            if has_registration:
                # Показываем галочку для уже записанного времени
                keyboard.append([InlineKeyboardButton(
                    text=f"✅ {time} (уже записан)",
                    callback_data="time_already_booked"
                )])
            elif available > 0:
                keyboard.append([InlineKeyboardButton(
                    text=f"{time} (свободно: {available})",
                    callback_data=f"edit_time_{time}"
                )])
            else:
                keyboard.append([InlineKeyboardButton(
                    text=f"{time} (занято)",
                    callback_data="time_full"
                )])
    else:
        for time in exam_times:
            # Проверяем, есть ли уже запись на это время
            has_registration = existing_registrations.get(time, False)
            
            if has_registration:
                # Показываем галочку для уже записанного времени
                keyboard.append([InlineKeyboardButton(
                    text=f"✅ {time} (уже записан)",
                    callback_data="time_already_booked"
                )])
            else:
                keyboard.append([InlineKeyboardButton(text=time, callback_data=f"edit_time_{time}")])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data=f"edit_school_{school}")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_edit_time)


async def handle_edit_school_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора школы при редактировании - показываем даты для выбранной школы"""
    await callback.answer()
    
    user_id = callback.from_user.id
    school = callback.data.replace("edit_school_", "")
    
    user_data[user_id]["edit_new_school"] = school
    subject = user_data[user_id].get("edit_subject", "экзамен")
    
    # Получаем даты из пробника для выбранной школы
    probnik = await get_active_probnik()
    exam_dates = get_exam_dates_from_probnik(probnik, school)
    
    if not exam_dates:
        await callback.message.edit_text(f"Ошибка: даты экзаменов для школы '{school}' не настроены. Обратитесь к администратору.")
        await state.clear()
        return
    
    # Показываем выбор даты для выбранной школы
    message_text = f"Школа: {school}\n\nВыберите дату для {subject}:"
    keyboard = []
    for date_item in exam_dates:
        if len(date_item) >= 2:
            date_label = date_item[0]
            date_value = date_item[1]
        else:
            continue
        # Форматируем дату для отображения
        try:
            from datetime import datetime
            date_obj = datetime.strptime(date_value, "%Y-%m-%d")
            formatted_date = date_obj.strftime("%d.%m.%Y")
        except:
            formatted_date = date_value
        display_text = f"{date_label} ({formatted_date})"
        keyboard.append([InlineKeyboardButton(text=display_text, callback_data=f"edit_date_{date_value}")])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="edit_change_datetime")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_edit_date)


async def handle_edit_time_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора времени при редактировании"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    if callback.data == "time_full":
        await callback.answer("Это время занято. Выберите другое время.", show_alert=True)
        return
    
    time = callback.data.replace("edit_time_", "")
    
    registration_id = user_data[user_id].get("edit_registration_id")
    student_id = user_data[user_id].get("student_id")
    subject = user_data[user_id].get("edit_subject")
    date = user_data[user_id].get("edit_new_date")
    school = user_data[user_id].get("edit_new_school")
    
    if not all([registration_id, student_id, subject, date, school]):
        await callback.message.edit_text("Ошибка: неполные данные. Пожалуйста, начните заново.")
        await state.clear()
        return
    
    # Удаляем старую запись
    delete_result = await make_api_request("DELETE", f"/telegram/registration/{registration_id}")
    
    if not delete_result:
        await callback.message.edit_text("Ошибка при удалении старой записи.")
        await state.clear()
        return
    
    # Создаем новую запись
    result = await make_api_request("POST", "/telegram/register-exam", {
        "student_id": student_id,
        "subject": subject,
        "exam_date": date,
        "exam_time": time,
        "school": school
    })
    
    if result:
        await callback.message.edit_text(
            f"✅ Запись успешно изменена!\n\n"
            f"Предмет: {subject}\n"
            f"Новая дата: {date}\n"
            f"Время: {time}\n"
            f"Школа: {school}"
        )
        
        keyboard = [
            [InlineKeyboardButton(text="Посмотреть мои записи", callback_data="view_registrations")],
            [InlineKeyboardButton(text="На главную", callback_data="back_to_start")]
        ]
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        await callback.message.answer("Выберите действие:", reply_markup=reply_markup)
    else:
        await callback.message.edit_text(
            "Ошибка при создании новой записи. Возможно, все места заняты."
        )
    
    await state.clear()


async def handle_delete_registration(callback: CallbackQuery, state: FSMContext):
    """Удаление записи на экзамен"""
    await callback.answer()
    
    user_id = callback.from_user.id
    registration_id = int(callback.data.replace("delete_reg_", ""))
    
    # Подтверждение удаления
    user_data[user_id]["delete_registration_id"] = registration_id
    
    message_text = "Вы уверены, что хотите удалить эту запись?"
    keyboard = [
        [InlineKeyboardButton(text="✅ Да, удалить", callback_data=f"confirm_delete_{registration_id}")],
        [InlineKeyboardButton(text="❌ Нет, отмена", callback_data=f"edit_reg_{registration_id}")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)


async def handle_confirm_delete_registration(callback: CallbackQuery, state: FSMContext):
    """Подтверждение удаления записи"""
    await callback.answer()
    
    registration_id = int(callback.data.replace("confirm_delete_", ""))
    
    # Удаляем запись
    result = await make_api_request("DELETE", f"/telegram/registration/{registration_id}")
    
    if result:
        await callback.message.edit_text("✅ Запись успешно удалена!")
        
        keyboard = [
            [InlineKeyboardButton(text="Посмотреть мои записи", callback_data="view_registrations")],
            [InlineKeyboardButton(text="На главную", callback_data="back_to_start")]
        ]
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        await callback.message.answer("Выберите действие:", reply_markup=reply_markup)
    else:
        await callback.message.edit_text("Ошибка при удалении записи.")
    
    await state.clear()


async def back_to_start_callback(callback: CallbackQuery, state: FSMContext):
    """Возврат к начальному экрану"""
    await callback.answer()
    
    user_id = callback.from_user.id
    user = callback.from_user
    
    # Проверяем, есть ли уже привязанный студент
    student_result = await make_api_request("GET", f"/telegram/student-by-user-id/{user_id}")
    
    if student_result and "id" in student_result:
        # Студент уже зарегистрирован
        student_id = student_result["id"]
        class_num = student_result.get("class_num")
        fio = student_result["fio"]
        
        # Получаем текущие записи
        registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
        existing_count = len(registrations_result) if registrations_result else 0
        
        # Получаем максимальное количество записей из пробника
        probnik = await get_active_probnik()
        max_registrations = 4  # Значение по умолчанию
        if probnik:
            max_registrations = probnik.get("max_registrations", 4)
        
        # Сохраняем данные в user_data для продолжения
        user_data[user_id] = {
            "student_id": student_id,
            "class_num": class_num,
            "fio": fio
        }
        
        if existing_count >= max_registrations:
            # Уже записался на максимальное количество экзаменов
            message_text = (
                f"Привет, {user.first_name}! 👋\n\n"
                f"Вы уже зарегистрированы как {fio}.\n\n"
                "Ваши записи на экзамены:\n\n"
            )
            if registrations_result:
                for reg in registrations_result:
                    school_info = f" ({reg.get('school', 'не указана')})" if reg.get('school') else ""
                    message_text += f"• {reg['subject']} - {reg['exam_date']} в {reg['exam_time']}{school_info}\n"
            message_text += f"\nВы уже записались на максимальное количество экзаменов ({max_registrations})."
            
            await callback.message.edit_text(message_text)
            await state.clear()
            return
        else:
            # Можно еще записаться
            message_text = (
                f"Привет, {user.first_name}! 👋\n\n"
                f"Вы уже зарегистрированы как {fio}.\n"
                f"У вас записано экзаменов: {existing_count}/4\n\n"
                "Хотите записаться еще на экзамен?"
            )
            
            keyboard = [
                [InlineKeyboardButton(text="Да, записаться", callback_data="continue_registration")],
                [InlineKeyboardButton(text="Посмотреть мои записи", callback_data="view_registrations")]
            ]
            reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
            
            await callback.message.edit_text(message_text, reply_markup=reply_markup)
            await state.clear()
            return
    
    # Новый пользователь - показываем приветствие
    welcome_message = (
        f"Привет, {user.first_name}! 👋\n\n"
        "Это бот школы Гарри, который поможет вам записаться на зимний пробник.\n\n"
        "Я помогу вам:\n"
        "• Найти вашу запись в базе данных\n"
        "• Выбрать предметы для экзамена\n"
        "• Записаться на удобное время\n\n"
        "Готовы начать?"
    )
    
    keyboard = [[InlineKeyboardButton(text="Записаться", callback_data="register")]]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    
    await callback.message.edit_text(welcome_message, reply_markup=reply_markup)
    await state.clear()


async def finish_registration_callback(callback: CallbackQuery, state: FSMContext):
    """Завершение регистрации"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    student_id = user_data[user_id].get("student_id")
    
    if not student_id:
        await callback.message.edit_text("Ошибка: ID студента не найден.")
        await state.clear()
        return
    
    # Получаем все записи
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    existing_count = len(registrations_result) if registrations_result else 0
    
    if registrations_result:
        message_text = "Ваши записи на экзамены:\n\n"
        for reg in registrations_result:
            school_info = f" ({reg.get('school', 'не указана')})" if reg.get('school') else ""
            message_text += f"• {reg['subject']} - {reg['exam_date']} в {reg['exam_time']}{school_info}\n"
    else:
        message_text = "У вас пока нет записей на экзамены."
    
    message_text += "\n\nРегистрация завершена! Мы напомним вам о предстоящих экзаменах."
    
    # Если еще можно записаться (меньше 4 записей), показываем кнопку
    if existing_count < 4:
        keyboard = [
            [InlineKeyboardButton(text="Записаться еще", callback_data="continue_registration")]
        ]
        reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
        await callback.message.edit_text(message_text, reply_markup=reply_markup)
    else:
        await callback.message.edit_text(message_text)
    
    # Очищаем данные пользователя
    if user_id in user_data:
        del user_data[user_id]
    
    await state.clear()


async def cancel_command(message: Message, state: FSMContext):
    """Отмена регистрации"""
    user_id = message.from_user.id
    
    if user_id in user_data:
        del user_data[user_id]
    
    message_text = "Регистрация отменена. Если хотите начать заново, используйте команду /start"
    
    await message.answer(message_text, reply_markup=ReplyKeyboardRemove())
    await state.clear()


async def cancel_callback(callback: CallbackQuery, state: FSMContext):
    """Отмена регистрации через callback"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    if user_id in user_data:
        del user_data[user_id]
    
    message_text = "Регистрация отменена. Если хотите начать заново, используйте команду /start"
    
    await callback.message.edit_text(message_text)
    await state.clear()


async def send_notifications(bot: Bot):
    """Отправка уведомлений (вызывается периодически)"""
    result = await make_api_request("GET", "/telegram/pending-notifications")
    
    if not result:
        return
    
    # Отправляем уведомления через 24 часа
    for notification in result.get("reminder_24h", []):
        try:
            await bot.send_message(
                chat_id=notification["user_id"],
                text=notification["message"]
            )
        except Exception as e:
            logger.error(f"Error sending 24h reminder: {e}")
    
    # Отправляем уведомления за 3 дня
    for notification in result.get("reminder_3d", []):
        try:
            keyboard = [
                [
                    InlineKeyboardButton(
                        text="Подтвердить участие",
                        callback_data=f"confirm_{notification['registration_id']}"
                    ),
                    InlineKeyboardButton(text="Отменить", callback_data="cancel_participation")
                ]
            ]
            reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
            await bot.send_message(
                chat_id=notification["user_id"],
                text=notification["message"],
                reply_markup=reply_markup
            )
        except Exception as e:
            logger.error(f"Error sending 3d reminder: {e}")
    
    # Отправляем уведомления за 1 день
    for notification in result.get("reminder_1d", []):
        try:
            keyboard = [
                [
                    InlineKeyboardButton(
                        text="Подтвердить участие",
                        callback_data=f"confirm_{notification['registration_id']}"
                    ),
                    InlineKeyboardButton(text="Отменить", callback_data="cancel_participation")
                ]
            ]
            reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
            await bot.send_message(
                chat_id=notification["user_id"],
                text=notification["message"],
                reply_markup=reply_markup
            )
        except Exception as e:
            logger.error(f"Error sending 1d reminder: {e}")


async def confirm_participation_callback(callback: CallbackQuery):
    """Подтверждение участия в экзамене"""
    await callback.answer()
    
    registration_id = int(callback.data.split("_")[-1])
    
    result = await make_api_request("POST", f"/telegram/confirm-participation/{registration_id}")
    
    if result:
        await callback.message.edit_text("✅ Вы подтвердили участие в экзамене. До встречи!")
    else:
        await callback.message.edit_text("Ошибка при подтверждении участия.")


async def periodic_notifications(bot: Bot):
    """Периодическая отправка уведомлений"""
    while True:
        try:
            await send_notifications(bot)
        except Exception as e:
            logger.error(f"Error in periodic notifications: {e}")
        await asyncio.sleep(3600)  # Каждый час


async def check_probnik_activation(bot: Bot):
    """Проверка активации пробника и отправка уведомлений"""
    global last_probnik_active
    
    while True:
        try:
            probnik = await get_active_probnik()
            is_active = probnik is not None and probnik.get("is_active", False)
            
            # Если пробник только что стал активным
            if is_active and not last_probnik_active:
                logger.info("Probnik activated! Sending notifications...")
                probnik_name = probnik.get("name", "Пробник")
                
                # Получаем всех пользователей с привязанным Telegram
                users_result = await make_api_request("GET", "/telegram/users-with-telegram")
                
                if users_result and users_result.get("users"):
                    for user_info in users_result["users"]:
                        user_id = user_info.get("user_id")
                        if user_id:
                            try:
                                keyboard = [[InlineKeyboardButton(text="Записаться", callback_data="continue_registration")]]
                                reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
                                
                                await bot.send_message(
                                    chat_id=user_id,
                                    text=f"🎉 Открыта запись на {probnik_name}!\n\n"
                                         f"Нажмите кнопку ниже, чтобы записаться на экзамен.",
                                    reply_markup=reply_markup
                                )
                                logger.info(f"Notification sent to user {user_id}")
                            except Exception as e:
                                logger.error(f"Failed to send notification to {user_id}: {e}")
                
                # Очищаем список ожидающих
                waiting_for_registration.clear()
            
            last_probnik_active = is_active
            
        except Exception as e:
            logger.error(f"Error checking probnik activation: {e}")
        
        await asyncio.sleep(30)  # Проверяем каждые 30 секунд


async def main():
    """Запуск бота"""
    # Получаем токен из переменной окружения
    token = os.getenv("TELEGRAM_BOT_TOKEN", "8542794827:AAEeNkKJ1CeWT1C09niCJOtmf9aX9zBza8M")
    if not token:
        logger.error("TELEGRAM_BOT_TOKEN не установлен!")
        return
    
    # Создаем бота и диспетчер
    bot = Bot(token=token)
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)
    
    # Устанавливаем команды меню (боковое меню)
    try:
        await bot.set_my_commands([
            BotCommand(command="start", description="🔄 Обновить бота")
        ])
        logger.info("Команды меню установлены")
    except Exception as e:
        logger.error(f"Ошибка при установке команд меню: {e}")
    
    # Регистрируем обработчики команд
    dp.message.register(start_command, CommandStart())
    dp.message.register(cancel_command, Command("cancel"))
    
    # Регистрируем обработчики callback
    dp.callback_query.register(register_callback, F.data == "register")
    dp.callback_query.register(confirm_student_callback, F.data == "confirm_student")
    dp.callback_query.register(create_new_student_callback, F.data == "create_new_student")
    dp.callback_query.register(handle_class_selection, F.data.startswith("class_"))
    dp.callback_query.register(handle_student_selection, F.data.startswith("select_student_"))
    dp.callback_query.register(handle_subject_already_selected, F.data.startswith("subject_already_selected_"))
    dp.callback_query.register(handle_subject_selection, F.data.startswith("subject_"))
    dp.callback_query.register(back_to_subjects_callback, F.data == "back_to_subjects")
    dp.callback_query.register(back_to_dates_callback, F.data == "back_to_dates")
    dp.callback_query.register(back_to_school_callback, F.data == "back_to_school")
    dp.callback_query.register(back_to_schools_callback, F.data == "back_to_schools")
    dp.callback_query.register(handle_date_selection, F.data.startswith("date_"))
    dp.callback_query.register(handle_school_selection, F.data.startswith("school_"))
    dp.callback_query.register(handle_time_already_booked, F.data == "time_already_booked")
    dp.callback_query.register(handle_time_selection, F.data.startswith("time_"))
    dp.callback_query.register(register_more_callback, F.data == "register_more")
    dp.callback_query.register(continue_registration_callback, F.data == "continue_registration")
    dp.callback_query.register(view_registrations_callback, F.data == "view_registrations")
    dp.callback_query.register(edit_registration_callback, F.data == "edit_registration")
    dp.callback_query.register(handle_edit_registration_selection, F.data.startswith("edit_reg_"))
    dp.callback_query.register(handle_edit_change_datetime, F.data == "edit_change_datetime")
    dp.callback_query.register(handle_edit_date_selection, F.data.startswith("edit_date_"))
    dp.callback_query.register(handle_edit_school_selection, F.data.startswith("edit_school_"))
    dp.callback_query.register(handle_edit_time_selection, F.data.startswith("edit_time_"))
    dp.callback_query.register(handle_delete_registration, F.data.startswith("delete_reg_"))
    dp.callback_query.register(handle_confirm_delete_registration, F.data.startswith("confirm_delete_"))
    dp.callback_query.register(back_to_start_callback, F.data == "back_to_start")
    dp.callback_query.register(finish_registration_callback, F.data == "finish_registration")
    dp.callback_query.register(confirm_participation_callback, F.data.startswith("confirm_"))
    dp.callback_query.register(cancel_callback, F.data == "cancel")
    
    # Регистрируем обработчики состояний
    dp.message.register(handle_fio, RegistrationStates.waiting_for_fio, F.text)
    
    # Запускаем периодическую отправку уведомлений
    asyncio.create_task(periodic_notifications(bot))
    
    # Запускаем проверку активации пробника
    asyncio.create_task(check_probnik_activation(bot))
    
    # Запускаем бота
    logger.info("Бот запущен...")
    try:
        await dp.start_polling(bot, allowed_updates=["message", "callback_query"])
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
