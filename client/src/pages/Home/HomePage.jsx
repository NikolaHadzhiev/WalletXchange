import { useSelector } from "react-redux";
import { message } from "antd";
import PageTitle from "../../components/PageTitle";
import { Disable2FA, RequestUserDelete } from "../../api/users";
import { ReloadUser } from "../../state/userSlice";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";

function Home() {
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  // Add window resize listener for mobile detection
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initialize on mount

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const handleEnable2FA = async () => {
    navigate("/enable-2fa");
  };

  const handleDisable2FA = async () => {
    try {
      dispatch(ShowLoading());
      const response = await Disable2FA({ _id: user._id });
      dispatch(HideLoading());
      if (response.success) {
        message.success(response.message);
        dispatch(ReloadUser(true));
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  const requestUserDelete = async () => {
    try {
      dispatch(ShowLoading());
      const response = await RequestUserDelete({
        _id: user._id,
        requestDelete: true,
      });
      dispatch(HideLoading());
      if (response.success) {
        message.success(response.message);
        dispatch(ReloadUser(true));
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  return (
    <div className={`flex flex-col items-center ${isMobile ? "sm-p-1" : "m-2"} home`}>
      <PageTitle
        title={`Hello ${user.firstName} ${user.lastName}, Welcome to WALLETXCHANGE`}
      />
      <div className="bg-secondary p-2 mt-7 w-800 br-3 flex flex-col gap-1 uppercase sm-w-100 home-tile">
        <div className="flex justify-between">
          <h1 className={`text-md text-white ${isMobile ? "text-sm" : ""}`}>
            Account Number
          </h1>
          <h1 className={`text-md text-white ${isMobile ? "text-sm" : ""}`}>
            {user._id}
          </h1>
        </div>
        <div className="flex justify-between">
          <h1 className={`text-md text-white ${isMobile ? "text-sm" : ""}`}>
            Balance
          </h1>
          <h1 className={`text-md text-white ${isMobile ? "text-sm" : ""}`}>
            $ {user.balance.toFixed(2) || 0}
          </h1>
        </div>
      </div>

      <div className="card p-2 mt-3 w-800 br-3 flex flex-col gap-1 uppercase sm-w-100">
        <div className={`flex ${isMobile ? "sm-flex-col" : "justify-between"}`}>
          <h1 className={`text-md ${isMobile ? "sm-text-center" : ""}`}>
            First Name
          </h1>
          <h1
            className={`text-md ${isMobile ? "sm-text-center mb-2" : ""}`}
          >
            {user.firstName}
          </h1>
        </div>
        <div className={`flex ${isMobile ? "sm-flex-col" : "justify-between"}`}>
          <h1 className={`text-md ${isMobile ? "sm-text-center" : ""}`}>
            Last Name
          </h1>
          <h1
            className={`text-md ${isMobile ? "sm-text-center mb-2" : ""}`}
          >
            {user.lastName}
          </h1>
        </div>
        <div className={`flex ${isMobile ? "sm-flex-col" : "justify-between"}`}>
          <h1 className={`text-md ${isMobile ? "sm-text-center" : ""}`}>
            Email
          </h1>
          <h1
            className={`text-md ${isMobile ? "sm-text-center mb-2" : ""}`}
          >
            {user.email}
          </h1>
        </div>
        <div className={`flex ${isMobile ? "sm-flex-col" : "justify-between"}`}>
          <h1 className={`text-md ${isMobile ? "sm-text-center" : ""}`}>
            Mobile
          </h1>
          <h1
            className={`text-md ${isMobile ? "sm-text-center mb-2" : ""}`}
          >
            {user.phoneNumber}
          </h1>
        </div>
        <div className={`flex ${isMobile ? "sm-flex-col" : "justify-between"}`}>
          <h1 className={`text-md ${isMobile ? "sm-text-center" : ""}`}>
            Identification Type
          </h1>
          <h1
            className={`text-md ${isMobile ? "sm-text-center mb-2" : ""}`}
          >
            {user.identificationType}
          </h1>
        </div>
        <div className={`flex ${isMobile ? "sm-flex-col" : "justify-between"}`}>
          <h1 className={`text-md ${isMobile ? "sm-text-center" : ""}`}>
            Identification Number
          </h1>
          <h1
            className={`text-md ${isMobile ? "sm-text-center mb-2" : ""}`}
          >
            {user.identificationNumber}
          </h1>
        </div>
      </div>

      <div
        className={`${
          isMobile
            ? "flex flex-col w-100 mt-3"
            : "flex justify-center items-baseline mt-3"
        }`}
      >
        <div className={`${isMobile ? "w-100" : "flex gap-1 mr-1"}`}>
          {user.twoFactorEnabled ? (
            <button className="tfa-disable-btn" onClick={handleDisable2FA}>
              Disable 2FA
            </button>
          ) : (
            <button className="tfa-btn" onClick={handleEnable2FA}>
              Enable 2FA
            </button>
          )}
        </div>
        {!user.isAdmin && (
          <div className={`${isMobile ? "w-100 mt-2" : "flex gap-1"}`}>
            {!user.requestDelete ? (
              <button
                className="delete-contained-btn"
                onClick={() => requestUserDelete()}
              >
                Request Delete Account
              </button>
            ) : (
              <div className="primary-outlined-btn">
                Pending admin acceptance for deletion
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default Home;
