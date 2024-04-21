import { useEffect } from "react";
import { GetUserInfo } from "../api/users";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { SetUser } from "../state/userSlice";
import { HideLoading, ShowLoading } from "../state/loaderSlice";
import DefaultLayout from "./DefaultLayout";

function ProtectedRoute(props) {
  const { user } = useSelector((state) => state.users);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {

    const getData = async () => {

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
        
      } 
      catch (error) {

        dispatch(HideLoading());
        message.error(error.message);
        navigate("/login");

      }
    };

    if (localStorage.getItem("token")) {
      if (!user) {
        getData();
      }
    } else {
      navigate("/login");
    }
  }, [navigate, dispatch, user]);

  return (
    user && (
      <>
        <DefaultLayout>{props.children}</DefaultLayout>
      </>
    )
  );
}

export default ProtectedRoute;
