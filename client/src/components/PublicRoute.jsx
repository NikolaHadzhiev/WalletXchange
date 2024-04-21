import { useEffect } from "react";
import {useNavigate} from "react-router-dom";

function PublicRoute(props) {
  const navigate = useNavigate();
  useEffect(() => {
    if (localStorage.getItem("token")) {
      navigate("/");
    }
  }, [navigate]);

  return <div>{props.children}</div>;
}

export default PublicRoute;
