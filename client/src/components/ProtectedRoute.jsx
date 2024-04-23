import { useEffect, useCallback } from "react";
import { GetUserInfo } from "../api/users";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { SetUser, ReloadUser } from "../state/userSlice";
import { HideLoading, ShowLoading } from "../state/loaderSlice";
import DefaultLayout from "./DefaultLayout";

function ProtectedRoute({ shouldBeAdmin = false, children }) {
  const { user, reloadUser } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const getData = useCallback(async () => {
    try {
      dispatch(ShowLoading());

      const response = await GetUserInfo();

      dispatch(HideLoading());

      if (response.success) {
        dispatch(SetUser(response.data));
      } else {
        message.error(response.message);
        navigate("/login");
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
      navigate("/login");
    }
  }, [dispatch, navigate]);

  useEffect(() => {
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
