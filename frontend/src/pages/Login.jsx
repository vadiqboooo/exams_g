import React, { useState } from "react";
import axios from "axios";
import "./Login.css";

const API_BASE = "http://127.0.0.1:8000";

export default function Login({ showNotification }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogin(e) {
    e.preventDefault();
    setIsLoading(true);

    try {
      const resp = await axios.post(`${API_BASE}/auth/login`, null, {
        params: { username, password },
      });

      // Сохраняем токен и роль
      localStorage.setItem("token", resp.data.access_token);
      localStorage.setItem("role", resp.data.role);
      localStorage.setItem("teacher_name", resp.data.teacher_name);

      showNotification("Добро пожаловать!", "success");
      window.location.href = "/";
    } catch (err) {
      showNotification("Неверный логин или пароль", "error");
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
    </div>
  );
}
