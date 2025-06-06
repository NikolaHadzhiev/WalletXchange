import axios from 'axios';
import.meta.env.VITE_API_URL
import { handleApiError } from "../utils/handleApiError";

export const axiosInstance = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
    headers : {
          'authorization' : `Bearer ${localStorage.getItem('token')}`
    }
});

// Add a response interceptor
axiosInstance.interceptors.response.use(
  async (response) => {
        if (response?.data?.message === "jwt expired") {
          // Remove the expired token
          localStorage.removeItem("token");
          
          // Perform logout operation (use async/await in an async function)
          try {
            await axiosInstance.post("/api/users/logout", null, { withCredentials: true });
          } catch (logoutError) {
            console.error("Logout failed:", logoutError); // Handle logout failure
          }

          response.data.message =
            "Your session has been expired. Please login again.";
        }
        return response
    },
    (error) => {
      handleApiError(error);
      return Promise.reject(error)
    }
  );