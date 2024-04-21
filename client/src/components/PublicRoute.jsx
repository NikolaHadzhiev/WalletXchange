import { useEffect } from "react";
import {useNavigate} from "react-router-dom";
import { useSelector } from "react-redux";

function PublicRoute(props) {
  const { user } = useSelector(state => state.users);

  const navigate = useNavigate();
  useEffect(() => {
    if (user && localStorage.getItem("token")) {
      navigate("/");
    }
  }, [navigate, user]);

  return <div>{props.children}</div>;
}

export default PublicRoute;
