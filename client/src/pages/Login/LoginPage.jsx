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
          message.error(response.message);
          navigate('/verify-2fa', { state: { userId: response.userId } });
        } else {
          message.success(response.message);
          localStorage.setItem("token", response.data);
          window.location.href = "/";
        }
      } else {
        if (response.remainingTime) {
          // Handle lockout
          setIsLockedOut(true);
          setLockoutTime(response.remainingTime);
          message.error(`Too many attempts. Try again in ${response.remainingTime}s.`);
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
      <div className="card w-400 p-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl">WALLETXCHANGE - LOGIN</h1>
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
            {isLockedOut ? `Try again in ${lockoutTime}s` : "Login"}
          </button>

          <h1
            className="text-sm underline mt-2"
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
