import axios from 'axios';

export const axiosInstance = axios.create({
    baseURL: "http://localhost:5000",
    headers : {
          'authorization' : `Bearer ${localStorage.getItem('token')}`
    }
});

// Add a response interceptor
axiosInstance.interceptors.response.use(
    (response) => {
        if (response?.data?.message === "jwt expired") {
            // Remove the expired token
            localStorage.removeItem('token');
            // // Redirect to the login page
            // window.location.href = '/login';

            response.data.message = "Your session has been expired. Please login again."
          }
        return response
    },// Pass through if the response is successful
    (error) => Promise.reject(error)
  );