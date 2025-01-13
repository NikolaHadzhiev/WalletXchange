import { useNavigate } from "react-router-dom";
import { Col, Form, Row, Input, message } from "antd";
import { LoginUser } from "../../api/users";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import { useDispatch } from "react-redux";


function Login() {

  const navigate = useNavigate();
  const dispatch = useDispatch();

  const onFinish = async (values) => {
    try {

      dispatch(ShowLoading());

      const response = await LoginUser(values);

      dispatch(HideLoading());

      if (response.success) {
        if (response.twoFA) {
          message.error(response.message);
          // Redirect to a 2FA verification page
          navigate('/verify-2fa', { state: { userId: response.userId } });
        } 
        else {
          message.success(response.message);
          localStorage.setItem("token", response.data);
          // Because sometimes the home page may load before putting the data in local storage causing errors
          window.location.href = "/";
        }
      } else {
        message.error(response.message);
      }
    } 
    catch (error) {
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

          <button className="primary-contained-btn w-100" type="submit">
            Login
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
