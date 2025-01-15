import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import { CheckDDoSProtection } from "../api/ddos"; // Import the DDoS protection check

function PublicRoute(props) {
  const { user } = useSelector(state => state.users);
  const navigate = useNavigate();

  const checkRateLimiting = async () => {
    const response = await CheckDDoSProtection(); // Call the new DDoS protection function

    if (response.message && response.message.includes("Too many requests")) {
      navigate("/ddos-protection"); // Redirect to DDoS protection page
    }
  };

  useEffect(() => {
    checkRateLimiting(); // Check DDoS protection when the component mounts

    if (user && localStorage.getItem("token")) {
      navigate("/");
    }
  }, [navigate, user]);

  return <div>{props.children}</div>;
}

export default PublicRoute;
