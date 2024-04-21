import { useEffect } from "react";
import { GetUserInfo } from "../api/users";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { SetUser } from "../state/userSlice";

function ProtectedRoute(props) {
  const { user } = useSelector(state => state.users);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  useEffect(() => {
    const getData = async () => {
      try {
        const response = await GetUserInfo();
  
        if (response.success) {
          dispatch(SetUser(response.data))
        } else {
          message.error(response.message);
          navigate("/login");
        }
      } catch (error) {
        message.error(error.message);
        navigate("/login");
      }
    };

    if (localStorage.getItem("token")) {

      if(!user) {
        getData();
      }
    } else {
      navigate("/login");
    }
  }, [navigate, dispatch, user]);

  return user && 
  
  <div>
    {user.email}
    {props.children}
  </div>;
}

export default ProtectedRoute;
