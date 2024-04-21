import { useState, useEffect } from "react";
import { GetUserInfo } from "../api/users";
import { message } from "antd";
import { useNavigate } from "react-router-dom";

function ProtectedRoute(props) {
  const [userData, setUserData] = useState(null);
  const navigate = useNavigate();

  const getData = async () => {
    try {
      const response = await GetUserInfo();

      if (response.success) {
        setUserData(response.data);
      } else {
        message.error(response.message);
        navigate("/login");
      }
    } catch (error) {
      message.error(error.message);
      navigate("/login");
    }
  };

  useEffect(() => {
    if (localStorage.getItem("token")) {

      if(!userData) {
        getData();
      }
    } else {
      navigate("/login");
    }
  }, [userData, navigate]);

  return <div>{props.children}</div>;
}

export default ProtectedRoute;
