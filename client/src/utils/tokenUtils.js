import { jwtDecode } from "jwt-decode";

export const getTokenExpiryTime = () => {
  const token = localStorage.getItem("token");
  if (!token) return null;

  const decoded = jwtDecode(token);
  return decoded.exp ? decoded.exp * 1000 : null; // Convert to milliseconds
};