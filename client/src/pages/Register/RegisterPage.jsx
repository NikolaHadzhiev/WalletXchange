import { Col, Form, Row, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();
  const onFinish = async (values) => {
    console.log(values);
  };

  return (
    <div className="bg-primary flex items-center justify-center h-screen">
      <div className="card w-800 p-2">
        <div className="flex items-center justify-between">
          <h1 className="text-xl">WALLETXCHAGE - REGISTER</h1>
        </div>
        <hr />
        <Form layout="vertical" onFinish={onFinish} autoComplete="off">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="First Name"
                name="firstName"
                rules={[
                  {
                    required: true,
                    message: "Please input your first name!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Last Name"
                name="lastName"
                rules={[
                  {
                    required: true,
                    message: "Please input your last name!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    required: true,
                    message: "Please input your email!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Mobile"
                name="phoneNumber"
                rules={[
                  {
                    required: true,
                    message: "Please input your phone number!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={24}>
              <Form.Item
                label="Address"
                name="address"
                rules={[
                  {
                    required: true,
                    message: "Please input your address!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item 
                 label="Identification Type" 
                 name="identificationType"
                 rules={[
                    {
                      required: true,
                      message: "Please choose identification type!",
                    },
                  ]}
                 >
              <Select>
                  <Select.Option value="NATIONAL ID">National ID</Select.Option>
                  <Select.Option value="PASSPORT">Passport</Select.Option>
                  <Select.Option value="DRIVING LICENSE">Driving License</Select.Option>
                  <Select.Option value="SOCIAL CARD">
                    Social Security Card (SSN)
                  </Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={18}>
              <Form.Item
                label="Identification Number"
                name="identificationNumber"
                rules={[
                  {
                    required: true,
                    message: "Please input your identification number!",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </Col>
            <Col span={12}>
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
            <Col span={12}>
              <Form.Item
                label="Confirm Password"
                name="confirmPassword"
                rules={[
                  {
                    required: true,
                    message: "Please confirm your password!",
                  },
                ]}
              >
                <Input.Password />
              </Form.Item>
            </Col>
          </Row>

          <button className="primary-contained-btn w-100" type="submit">
            Register
          </button>
          <h1
            className="text-sm underline mt-2"
            onClick={() => navigate("/login")}
          >
            Already a member? Click here to login
          </h1>
        </Form>
      </div>
    </div>
  );
}

export default Register;
