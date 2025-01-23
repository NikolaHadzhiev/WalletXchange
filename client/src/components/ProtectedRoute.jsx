import { useEffect, useCallback } from "react";
import { GetUserInfo } from "../api/users";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { SetUser, ReloadUser } from "../state/userSlice";
import { HideLoading, ShowLoading } from "../state/loaderSlice";
import DefaultLayout from "./DefaultLayout";
import { CheckDDoSProtection } from "../api/ddos"; // Import the DDoS protection check

function ProtectedRoute({ shouldBeAdmin = false, children }) {
  const { user, reloadUser } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const checkRateLimiting = async () => {
    const response = await CheckDDoSProtection(); // Call the new DDoS protection function

    if (response.message && response.message.includes("Too many requests")) {
      navigate("/ddos-protection"); // Redirect to DDoS protection page
    }
  };

  const getData = useCallback(async () => {
    try {
      dispatch(ShowLoading());

      const response = await GetUserInfo();

      dispatch(HideLoading());

      if (response.success) {
        dispatch(SetUser(response.data));
      } else {
        message.error(response.message, 1).then(() => {
          navigate("/login");
        });
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message, 1).then(() => {
        navigate("/login");
      });
    }
  }, [dispatch, navigate]);

  useEffect(() => {
    checkRateLimiting(); // Check DDoS protection when the component mounts

    if (localStorage.getItem("token")) {
      if (!user) {
        getData();
      }
    } else {
      navigate("/login");
    }

    dispatch(ReloadUser(false));
  }, [dispatch, navigate, user, getData]);

  useEffect(() => {
    if (reloadUser) {
      getData();
    }
  }, [getData, reloadUser]);

  useEffect(() => {
    if (localStorage.getItem("token")) {
      if (!user) {
        getData();
      } else {
        if (shouldBeAdmin && shouldBeAdmin !== user.isAdmin) {
          navigate("/");
        }
      }
    }

    dispatch(ReloadUser(false));

  }, [dispatch, getData, navigate, shouldBeAdmin, user]);

  return (
    user && (
      <>
        <DefaultLayout>{children}</DefaultLayout>
      </>
    )
  );
}

export default ProtectedRoute;
