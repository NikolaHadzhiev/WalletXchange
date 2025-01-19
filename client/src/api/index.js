import axios from 'axios';

export const axiosInstance = axios.create({
    baseURL: "http://localhost:5000",
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
    (error) => Promise.reject(error)
  );