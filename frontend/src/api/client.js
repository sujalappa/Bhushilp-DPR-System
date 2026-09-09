import axios from 'axios';

// withCredentials so the httpOnly session cookie is sent/received —
// the backend never uses a bearer token, only the cookie.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
});

// Every backend error response is { success: false, message }. Unwrap it so
// callers can just do `catch (err) { setError(err.message) }`.
client.interceptors.response.use(
  (res) => res,
  (err) => {
    const message = err.response?.data?.message || 'Something went wrong. Please try again.';
    return Promise.reject(new Error(message));
  }
);

export default client;
