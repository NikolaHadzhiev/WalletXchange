import { useEffect } from "react";
import { Modal, message } from "antd";
import { useNavigate } from "react-router-dom";
import { getTokenExpiryTime } from "../utils/tokenUtils";
import { RefreshToken } from "../api/users";

export const useSessionExpiryNotification = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const expiryTime = getTokenExpiryTime();
    if (!expiryTime) return;

    const currentTime = Date.now();
    const timeLeft = expiryTime - currentTime;
    const warningTime = 5 * 60 * 1000; // 5 minutes in milliseconds

    if (timeLeft > warningTime) {
      const timeoutId = setTimeout(() => {
        Modal.confirm({
            title: "Session Expiry Warning",
            content:
              "Your session will expire in 5 minutes. Please save your work or extend your session.",
            okText: "Extend Session",
            cancelText: "Dismiss",
            onOk: async () => {
              localStorage.removeItem("token");
              await RefreshToken();

              try {
                const response = await RefreshToken();
                if (response.success) {
                  message.success(response.message);
                  localStorage.setItem("token", response.data);
                } else {
                  message.error(response.message);
                }
              } catch (error) {
                message.error(error.message);
              }
            },
            onCancel: () => {},
          });
      }, timeLeft - warningTime);

      return () => clearTimeout(timeoutId); // Clear timeout on unmount
    }
  }, [navigate]);
};