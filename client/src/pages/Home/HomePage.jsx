import { useSelector } from "react-redux";
import { message } from "antd";
import PageTitle from "../../components/PageTitle";
import { Disable2FA, RequestUserDelete } from "../../api/users";
import { ReloadUser } from "../../state/userSlice";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

function Home() {
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  const navigate = useNavigate();

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
    <div className="flex flex-col items-center m-2">
      <PageTitle
        title={`Hello  ${user.firstName} ${user.lastName}, Welcome to WALLETXCHANGE`}
      />
      <div className="bg-secondary p-2 mt-7 w-800 br-3 flex flex-col gap-1 uppercase">
        <div className="flex justify-between">
          <h1 className="text-md text-white">Account Number</h1>
          <h1 className="text-md text-white">{user._id}</h1>
        </div>
        <div className="flex justify-between">
          <h1 className="text-md text-white">Balance</h1>
          <h1 className="text-md text-white">
            $ {user.balance.toFixed(2) || 0}
          </h1>
        </div>
      </div>

      <div className="card p-2 mt-3 w-800 br-3 flex flex-col gap-1 uppercase">
        <div className="flex justify-between">
          <h1 className="text-md">First Name</h1>
          <h1 className="text-md">{user.firstName}</h1>
        </div>
        <div className="flex justify-between">
          <h1 className="text-md">Last Name</h1>
          <h1 className="text-md">{user.lastName}</h1>
        </div>
        <div className="flex justify-between">
          <h1 className="text-md">Email</h1>
          <h1 className="text-md">{user.email}</h1>
        </div>
        <div className="flex justify-between">
          <h1 className="text-md">Mobile</h1>
          <h1 className="text-md">{user.phoneNumber}</h1>
        </div>
        <div className="flex justify-between">
          <h1 className="text-md">Identification Type</h1>
          <h1 className="text-md">{user.identificationType}</h1>
        </div>
        <div className="flex justify-between">
          <h1 className="text-md">Identification Number</h1>
          <h1 className="text-md">{user.identificationNumber}</h1>
        </div>
      </div>

      <div className="flex justify-center items-baseline mt-3">
        <div className="flex gap-1 mr-1">
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
          <div className="flex gap-1">
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
