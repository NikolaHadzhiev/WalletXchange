import { axiosInstance } from ".";

// Check if the user is rate-limited
export const CheckDDoSProtection = async () => {
  try {
    const { data } = await axiosInstance.get("/api/ddos-check");
    return data; // Return response, which could include rate-limited status or message
  } catch (error) {
    if (!error.response) {
      return { message: "Server error" };
    }
    return error.response.data;
  }
};
