import { useNavigate } from "react-router-dom";
import { Col, Form, Row, Input, message } from "antd";
import { LoginUser } from "../../api/users";

function Login() {
  const navigate = useNavigate();

  const onFinish = async (values) => {
    try {

      const response = await LoginUser(values);

      if (response.success) {
        message.success(response.message);
      } else {
        message.error(response.message);
      }
    } catch (error) {
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
