import { message } from "antd"; // Assuming you're using Ant Design for the message component

export const handleApiError = (error) => {
  if (!error.response) {
    // Handle network errors or server not reachable
    message.error("Network error. Please check your connection and try again.");
    return;
  }

  const status = error.response.status;

  if (status === 502) {
    // Handle 502 Bad Gateway
    message.error(
      "Something went wrong on the server. Please try again later."
    );
  }
};