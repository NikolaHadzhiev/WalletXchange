import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Enable2FA, Check2FAStatus } from "../../api/users";
import { QRCodeCanvas } from "qrcode.react";
import { ReloadUser } from "../../state/userSlice";
import { useSelector, useDispatch } from "react-redux";
import { message } from "antd";

function EnableTwoFactorAuth() {
  const [otpauthUrl, setOtpAuthUrl] = useState("");
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if 2FA is already enabled on component mount
    const check2FA = async () => {
      try {
        const response = await Check2FAStatus({ userId: user._id });
        if (response.isEnabled) {
          message.error(response.message);
          dispatch(ReloadUser(true));
          navigate("/"); // Redirect to home page
        }
      } catch (error) {
        console.error("Error checking 2FA status:", error);
        message.error("An unexpected error occurred. Please try again.");
      }
    };

    check2FA();
  }, [user._id, navigate, dispatch]);

  const handleEnable2FA = async () => {
    try {
      const response = await Enable2FA({ userId: user._id });

      if (response.success) {
        setOtpAuthUrl(response.data.otpauthUrl);
        dispatch(ReloadUser(true));
      } else {
        alert(response.message);
      }
    } catch (error) {
      console.error("Error enabling 2FA:", error);
      message.error("An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center h-80-p">
      <div className="card w-400 p-2">
        <h1 className="text-xl mb-2">Enable Two-Factor Authentication</h1>
        {!otpauthUrl && (
          <button onClick={handleEnable2FA} className="btn btn-primary w-full">
            Generate 2FA Secret
          </button>
        )}
        {otpauthUrl && (
          <div className="mt-4 text-center">
            <h2 className="text-lg">Scan this QR Code:</h2>
            <QRCodeCanvas value={otpauthUrl} size={200} />
            <p className="text-sm mt-2">
              Use an authenticator app (e.g., Google Authenticator) to scan this
              QR code.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default EnableTwoFactorAuth;
