import { Form, Input, Button, message } from "antd";
import { Verify2FA } from "../../api/users";
import { useLocation } from "react-router-dom";

function VerifyTwoFactorAuth () {
  const location = useLocation(); // To get userId passed during the login

  const onFinish = async (values) => {
    try {
      const response = await Verify2FA({
        userId: location.state?.userId,
        token: values.token,
      });

      if (response.success) {
        message.success(response.message);
        localStorage.setItem("token", response.token);
        // Because sometimes the home page may load before putting the data in local storage causing errors
        window.location.href = "/";
      } else {
        message.error(response.message);
      }
    } catch (error) {
      message.error("Failed to verify 2FA.");
    }
  };

  return (
    <div className="flex items-center justify-center h-screen">
      <div className="card w-400 p-2">
        <h1 className="text-xl mb-2">Verify Two-Factor Authentication</h1>
        <Form layout="vertical" onFinish={onFinish}>
          <Form.Item
            label="Authentication Code"
            name="token"
            rules={[{ required: true, message: "Please enter your code!" }]}
          >
            <Input />
          </Form.Item>
          <Button type="primary" htmlType="submit" className="w-full">
            Verify
          </Button>
        </Form>
      </div>
    </div>
  );
}

export default VerifyTwoFactorAuth;
