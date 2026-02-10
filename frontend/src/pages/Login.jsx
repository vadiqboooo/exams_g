import React, { useState } from "react";
import axios from "axios";
import Notification from "../components/common/Notification";
import "./Login.css";

// Используем относительный путь для работы через nginx proxy в Docker
// В development используем локальный сервер
const API_BASE = import.meta.env.VITE_API_BASE_URL || 
                 (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '');

export default function Login({ showNotification }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  // Внутренняя функция для показа уведомлений
  const showLocalNotification = (message, type = 'success') => {
    console.log("Показываем уведомление:", message, type); // Отладка
    setNotification({ message, type });
    // Автоматически скрываем через 3 секунды
    setTimeout(() => {
      setNotification(null);
    }, 3000);
  };

  async function handleLogin(e) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const resp = await axios.post(`${API_BASE}/auth/login`, null, {
        params: { username, password },
      });

      // Сохраняем токен, роль и школу
      localStorage.setItem("token", resp.data.access_token);
      localStorage.setItem("role", resp.data.role);
      localStorage.setItem("teacher_name", resp.data.teacher_name);
      localStorage.setItem("employee_id", resp.data.employee_id);
      if (resp.data.school) {
        localStorage.setItem("school", resp.data.school);
      }

      // Используем переданную функцию или локальную
      if (showNotification) {
        showNotification("Добро пожаловать!", "success");
      } else {
        showLocalNotification("Добро пожаловать!", "success");
      }
      
      // Небольшая задержка перед редиректом, чтобы пользователь увидел уведомление
      setTimeout(() => {
        window.location.href = "/";
      }, 500);
    } catch (err) {
      // Получаем сообщение об ошибке из ответа сервера или используем стандартное
      const errorMessage = 
                          "Неверный логин или пароль";
      
      console.log("Ошибка входа:", err.response?.data?.detail); // Отладка
      console.log("Ошибка входа:", err.response?.data?.message);
      // Всегда используем локальную функцию для показа уведомления на странице логина
      showLocalNotification(errorMessage, "error");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="login-container">
      <form className="login-card" onSubmit={handleLogin}>
        <h2>Вход</h2>

        <input
          type="text"
          placeholder="Логин"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={isLoading}>
          {isLoading ? "Вход..." : "Войти"}
        </button>
      </form>

      {/* Отображаем уведомление, если оно есть */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}
    </div>
  );
}
