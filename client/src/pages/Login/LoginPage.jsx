import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Col, Form, Row, Input, message } from "antd";
import { LoginUser } from "../../api/users";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import { useDispatch } from "react-redux";
import DOMPurify from "dompurify";

function Login() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isLockedOut, setIsLockedOut] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initialize on mount

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    let interval;
    if (isLockedOut && lockoutTime > 0) {
      interval = setInterval(() => {
        setLockoutTime((prevTime) => {
          if (prevTime <= 1) {
            clearInterval(interval);
            setIsLockedOut(false);
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval); // Cleanup on unmount
  }, [isLockedOut, lockoutTime]);

  const sanitizeInput = (input) => DOMPurify.sanitize(input);

  const onFinish = async (values) => {
    try {
      // Sanitize email and password
      const sanitizedValues = {
        email: sanitizeInput(values.email),
        password: sanitizeInput(values.password),
      };

      dispatch(ShowLoading());
      const response = await LoginUser(sanitizedValues);
      dispatch(HideLoading());

      if (response.success) {
        if (response.twoFA) {
          message.error(response.message, 1).then(() => {
            navigate('/verify-2fa', { state: { userId: response.userId } });
          });
        } else {
          message.success(response.message, 1).then(() => {
            localStorage.setItem("token", response.data);
            window.location.href = "/";
          });
        }
      } else {
        if (response.remainingTime) {
          // Handle lockout
          setIsLockedOut(true);
          setLockoutTime(response.remainingTime);
          message.error(`Too many attempts.`);
        } else {
          message.error(response.message);
        }
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  return (
    <div className="bg-primary flex items-center justify-center h-screen">
      <div className={`card ${isMobile ? 'p-3 sm-w-100 m-2' : 'w-400 p-2'}`}>
        <div className="flex items-center justify-between">
          <h1 className={`${isMobile ? 'text-lg' : 'text-xl'} sm-text-center w-100`}>WALLETXCHANGE - LOGIN</h1>
        </div>
        <hr />
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Row gutter={16}>
            <Col span={24}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    type: "email",
                    message: "The input is not valid E-mail!",
                  },
                  {
                    required: true,
                    message: "Please input your email!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="Password"
                name="password"
                rules={[
                  {
                    required: true,
                    message: "Please input your password!",
                  },
                ]}
              >
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>

          <button
            className="primary-contained-btn w-100"
            type="submit"
            disabled={isLockedOut}
          >
            {"Login"}
          </button>

          <h1
            className={`${isMobile ? 'text-center' : ''} text-sm underline mt-2`}
            onClick={() => navigate("/register")}
          >
            Not a member? Click here to register
          </h1>
        </Form>
      </div>
    </div>
  );
}

export default Login;
