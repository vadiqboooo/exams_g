import asyncio
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, Optional

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
    ReplyKeyboardRemove
)

# Настройка логирования
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# URL API бэкенда (можно переопределить через переменную окружения)
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000")

# Даты экзаменов
EXAM_DATES = [
    ("Понедельник 5.01.26", "2026-01-05"),
    ("Вторник 6.01.26", "2026-01-06"),
    ("Среда 7.01.26", "2026-01-07"),
    ("Четверг 8.01.26", "2026-01-08"),
    ("Пятница 9.01.26", "2026-01-09"),
    ("Суббота 10.01.26", "2026-01-10"),
    ("Воскресенье 12.01.26", "2026-01-12"),
]

EXAM_TIMES = ["9:00", "12:00"]

# FSM состояния
class RegistrationStates(StatesGroup):
    waiting_for_fio = State()
    waiting_for_group_confirm = State()
    waiting_for_subject = State()
    waiting_for_date = State()
    waiting_for_time = State()


# Хранение временных данных пользователей
user_data: Dict[int, Dict] = {}


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


async def start_command(message: Message, state: FSMContext):
    """Обработчик команды /start"""
    user = message.from_user
    user_id = user.id
    logger.info(f"Start command from user {user_id}")
    
    # Проверяем, есть ли уже привязанный студент
    student_result = await make_api_request("GET", f"/telegram/student-by-user-id/{user_id}")
    logger.info(f"Student lookup result for user {user_id}: {student_result is not None}")
    
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
        
        # Сохраняем данные в user_data для продолжения
        user_data[user_id] = {
            "student_id": student_id,
            "class_num": class_num,
            "fio": fio
        }
        
        if existing_count >= 4:
            # Уже записался на 4 экзамена
            message_text = (
                f"Привет, {user.first_name}! 👋\n\n"
                f"Вы уже зарегистрированы как {fio}.\n\n"
                "Ваши записи на экзамены:\n\n"
            )
            if registrations_result:
                for reg in registrations_result:
                    message_text += f"• {reg['subject']} - {reg['exam_date']} в {reg['exam_time']}\n"
            message_text += "\nВы уже записались на максимальное количество экзаменов (4)."
            
            await message.answer(message_text)
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
            
            await message.answer(message_text, reply_markup=reply_markup)
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
        await message.answer(
            "К сожалению, я не нашел вас в базе данных. "
            "Пожалуйста, проверьте правильность ввода ФИО или обратитесь к администратору."
        )
        await state.clear()
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
            [InlineKeyboardButton(text="Нет, это не я", callback_data="cancel")]
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
        [InlineKeyboardButton(text="Нет, это не я", callback_data="cancel")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.answer("Подтвердите:", reply_markup=reply_markup)
    await state.set_state(RegistrationStates.waiting_for_group_confirm)


async def confirm_student_callback(callback: CallbackQuery, state: FSMContext):
    """Обработка подтверждения студента"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    student_id = user_data[user_id].get("student_id")
    
    if not student_id:
        await callback.message.edit_text("Ошибка: данные студента не найдены.")
        await state.clear()
        return
    
    # Подтверждаем студента
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
    
    if existing_count >= 4:
        message_text = "Вы уже записались на 4 экзамена. Это максимальное количество."
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
    
    # Показываем доступные даты
    message_text = f"Вы выбрали: {subject}\n\nВыберите дату экзамена:"
    keyboard = []
    for date_label, date_value in EXAM_DATES:
        keyboard.append([InlineKeyboardButton(text=date_label, callback_data=f"date_{date_value}")])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_subjects")])
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
    
    await state.set_state(RegistrationStates.waiting_for_date)


async def handle_date_selection(callback: CallbackQuery, state: FSMContext):
    """Обработка выбора даты"""
    await callback.answer()
    
    user_id = callback.from_user.id
    
    # Загружаем данные из базы данных, если их нет в user_data
    if not await ensure_user_data(user_id):
        await callback.message.edit_text("Ошибка: студент не найден. Пожалуйста, начните регистрацию заново с команды /start")
        await state.clear()
        return
    
    date = callback.data.replace("date_", "")
    
    user_data[user_id]["current_date"] = date
    
    student_id = user_data[user_id].get("student_id")
    
    # Получаем существующие записи для проверки занятых времен
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    
    # Проверяем доступные слоты
    slots_result = await make_api_request("GET", f"/telegram/available-slots/{date}")
    
    message_text = f"Выберите время экзамена:\n\n"
    keyboard = []
    
    if slots_result:
        slots = slots_result.get("slots", {})
        for time in EXAM_TIMES:
            # Проверяем, есть ли уже запись на это время
            has_registration = False
            if registrations_result:
                has_registration = any(
                    r.get("exam_date") == date and r.get("exam_time") == time 
                    for r in registrations_result
                )
            
            if has_registration:
                keyboard.append([InlineKeyboardButton(
                    text=f"✅ {time} (уже записан)",
                    callback_data="time_already_booked"
                )])
            else:
                slot_info = slots.get(time, {})
                available = slot_info.get("available", 0)
                if available > 0:
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
        for time in EXAM_TIMES:
            # Проверяем, есть ли уже запись на это время
            has_registration = False
            if registrations_result:
                has_registration = any(
                    r.get("exam_date") == date and r.get("exam_time") == time 
                    for r in registrations_result
                )
            
            if has_registration:
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
    """Возврат к выбору даты"""
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
    
    # Показываем доступные даты
    message_text = f"Вы выбрали: {subject}\n\nВыберите дату экзамена:"
    keyboard = []
    for date_label, date_value in EXAM_DATES:
        keyboard.append([InlineKeyboardButton(text=date_label, callback_data=f"date_{date_value}")])
    
    keyboard.append([InlineKeyboardButton(text="◀️ Назад", callback_data="back_to_subjects")])
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
    
    if not student_id or not subject or not date:
        await callback.message.edit_text("Ошибка: неполные данные. Пожалуйста, начните регистрацию заново.")
        await state.clear()
        return
    
    # Проверяем, есть ли уже запись на эту дату и время
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    if registrations_result:
        for reg in registrations_result:
            if reg.get("exam_date") == date and reg.get("exam_time") == time:
                # Уже есть запись на эту дату и время
                await callback.answer("У вас уже есть запись на это время в этот день. Выберите другое время.", show_alert=True)
                # Возвращаем к выбору времени
                slots_result = await make_api_request("GET", f"/telegram/available-slots/{date}")
                message_text = f"Выберите время экзамена:\n\n"
                keyboard = []
                
                if slots_result:
                    slots = slots_result.get("slots", {})
                    for time_option in EXAM_TIMES:
                        slot_info = slots.get(time_option, {})
                        available = slot_info.get("available", 0)
                        # Проверяем, есть ли уже запись на это время
                        has_registration = any(
                            r.get("exam_date") == date and r.get("exam_time") == time_option 
                            for r in registrations_result
                        )
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
                    for time_option in EXAM_TIMES:
                        has_registration = any(
                            r.get("exam_date") == date and r.get("exam_time") == time_option 
                            for r in registrations_result
                        )
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
        "exam_time": time
    })
    
    if result:
        await callback.message.edit_text(
            f"✅ Отлично! Вы успешно записались на экзамен:\n\n"
            f"Предмет: {subject}\n"
            f"Дата: {date}\n"
            f"Время: {time}\n\n"
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
    
    # Получаем все записи
    registrations_result = await make_api_request("GET", f"/telegram/student-registrations/{student_id}")
    
    if registrations_result:
        message_text = "Ваши записи на экзамены:\n\n"
        for reg in registrations_result:
            message_text += f"• {reg['subject']} - {reg['exam_date']} в {reg['exam_time']}\n"
        message_text += f"\nВсего записей: {len(registrations_result)}/4"
    else:
        message_text = "У вас пока нет записей на экзамены."
    
    keyboard = [
        [InlineKeyboardButton(text="Записаться еще", callback_data="continue_registration")],
        [InlineKeyboardButton(text="Назад", callback_data="back_to_start")]
    ]
    reply_markup = InlineKeyboardMarkup(inline_keyboard=keyboard)
    
    await callback.message.edit_text(message_text, reply_markup=reply_markup)
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
    
    if registrations_result:
        message_text = "Ваши записи на экзамены:\n\n"
        for reg in registrations_result:
            message_text += f"• {reg['subject']} - {reg['exam_date']} в {reg['exam_time']}\n"
    else:
        message_text = "У вас пока нет записей на экзамены."
    
    message_text += "\n\nРегистрация завершена! Мы напомним вам о предстоящих экзаменах."
    
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


async def main():
    """Запуск бота"""
    # Получаем токен из переменной окружения
    # token = os.getenv("TELEGRAM_BOT_TOKEN")
    token = "8542794827:AAEeNkKJ1CeWT1C09niCJOtmf9aX9zBza8M"
    if not token:
        logger.error("TELEGRAM_BOT_TOKEN не установлен!")
        return
    
    # Создаем бота и диспетчер
    bot = Bot(token=token)
    storage = MemoryStorage()
    dp = Dispatcher(storage=storage)
    
    # Регистрируем обработчики команд
    dp.message.register(start_command, CommandStart())
    dp.message.register(cancel_command, Command("cancel"))
    
    # Регистрируем обработчики callback
    dp.callback_query.register(register_callback, F.data == "register")
    dp.callback_query.register(confirm_student_callback, F.data == "confirm_student")
    dp.callback_query.register(handle_student_selection, F.data.startswith("select_student_"))
    dp.callback_query.register(handle_subject_already_selected, F.data.startswith("subject_already_selected_"))
    dp.callback_query.register(handle_subject_selection, F.data.startswith("subject_"))
    dp.callback_query.register(back_to_subjects_callback, F.data == "back_to_subjects")
    dp.callback_query.register(back_to_dates_callback, F.data == "back_to_dates")
    dp.callback_query.register(handle_date_selection, F.data.startswith("date_"))
    dp.callback_query.register(handle_time_already_booked, F.data == "time_already_booked")
    dp.callback_query.register(handle_time_selection, F.data.startswith("time_"))
    dp.callback_query.register(register_more_callback, F.data == "register_more")
    dp.callback_query.register(continue_registration_callback, F.data == "continue_registration")
    dp.callback_query.register(view_registrations_callback, F.data == "view_registrations")
    dp.callback_query.register(finish_registration_callback, F.data == "finish_registration")
    dp.callback_query.register(confirm_participation_callback, F.data.startswith("confirm_"))
    dp.callback_query.register(cancel_callback, F.data == "cancel")
    
    # Регистрируем обработчики состояний
    dp.message.register(handle_fio, RegistrationStates.waiting_for_fio, F.text)
    
    # Запускаем периодическую отправку уведомлений
    asyncio.create_task(periodic_notifications(bot))
    
    # Запускаем бота
    logger.info("Бот запущен...")
    try:
        await dp.start_polling(bot, allowed_updates=["message", "callback_query"])
    finally:
        await bot.session.close()


if __name__ == "__main__":
    asyncio.run(main())
