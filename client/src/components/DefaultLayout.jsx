import { useState } from "react";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";

function DefaultLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const { user } = useSelector((state) => state.users);
  const navigate = useNavigate();

  const userMenu = [
    {
      title: "Home",
      icon: <i className="ri-home-7-line"></i>,
      onClick: () => navigate("/"),
      path: "/",
    },
    {
      title: "Transactions",
      icon: <i className="ri-bank-line"></i>,
      onClick: () => navigate("/transactions"),
      path: "/transactions",
    },
    {
      title: "Requests",
      icon: <i className="ri-hand-heart-line"></i>,
      onClick: () => navigate("/requests"),
      path: "/requests",
    },
    {
      title: "Logout",
      icon: <i className="ri-logout-box-line"></i>,
      onClick: () => {
        localStorage.removeItem("token");
        navigate("/login");
      },
      path: "/logout",
    },
  ];

  const adminMenu = [
    {
      title: "Home",
      icon: <i className="ri-home-7-line"></i>,
      onClick: () => navigate("/"),
      path: "/",
    },
    {
      title: "Users",
      icon: <i className="ri-user-settings-line"></i>,
      onClick: () => navigate("/users"),
      path: "/users",
    },
    {
      title: "Transactions",
      icon: <i className="ri-bank-line"></i>,
      onClick: () => navigate("/transactions"),
      path: "/transactions",
    },
    {
      title: "Requests",
      icon: <i className="ri-hand-heart-line"></i>,
      onClick: () => navigate("/requests"),
      path: "/requests",
    },
    {
      title: "Logout",
      icon: <i className="ri-logout-box-line"></i>,
      onClick: () => {
        localStorage.removeItem("token");
        navigate("/login");
      },
      path: "/logout",
    },
  ];

  const menuToRender = user?.isAdmin ? adminMenu : userMenu;

  return (
    <div className="layout">
      <div className="sidebar">
        <div className="menu">
          {menuToRender.map((item, index) => {
            const isActive = window.location.pathname === item.path;

            return (
              <div
                key={index}
                className={`menu-item ${isActive ? "active-menu-item" : ""}`}
                onClick={item.onClick}
              >
                {item.icon}
                {!collapsed && (
                  <h1 className="text-white text-sm">{item.title}</h1>
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div className="body">
        <div className="header flex justify-between items-center">
          <div className="text-white">
            {!collapsed && (
              <i
                className="ri-close-line"
                onClick={() => setCollapsed(!collapsed)}
              ></i>
            )}
            {collapsed && (
              <i
                className="ri-menu-2-line"
                onClick={() => setCollapsed(!collapsed)}
              ></i>
            )}
          </div>
          <div>
            <h1 className="text-xl text-white">WALLET X CHANGE</h1>
          </div>
          <div>
            <h1 className="text-sm text-white underline">
              {user?.firstName} {user?.lastName}
            </h1>
          </div>
        </div>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}

export default DefaultLayout;
