import { Col, Form, Row, Input, Select, message, Steps } from "antd";
import { useNavigate } from "react-router-dom";
import { RegisterUser } from "../../api/users";
import { useDispatch } from "react-redux";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify";
import { useState, useEffect } from "react";

function Register() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const [form] = Form.useForm();
  const [currentStep, setCurrentStep] = useState(0);

  // Add window resize listener for mobile detection
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

  const onFinish = async (values) => {
    try {
      // Sanitize all inputs before sending them to the server
      const sanitizedValues = {};
      for (const key in values) {
        sanitizedValues[key] = DOMPurify.sanitize(values[key]);
      }

      dispatch(ShowLoading());
      const response = await RegisterUser(sanitizedValues);
      dispatch(HideLoading());

      if (response.success) {
        message.success(response.message, 1).then(() => {
          navigate("/login");
        });
      } else {
        message.error(response.message);
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(error.message);
    }
  };

  // Form sections for mobile stepped form
  const steps = [
    {
      title: "Basic Info",
      fields: ["firstName", "lastName", "email", "phoneNumber"],
    },
    {
      title: "Address",
      fields: ["address"],
    },
    {
      title: "Identification",
      fields: ["identificationType", "identificationNumber"],
    },
    {
      title: "Security",
      fields: ["password", "confirmPassword"],
    },
  ];
  const validateCurrentStep = async () => {
    try {
      // Validate only fields in current step
      const currentFields = steps[currentStep].fields;
      await form.validateFields(currentFields);
      return true;
    } catch (errorInfo) {
      return false;
    }
  };

  const handleNext = async () => {
    const isValid = await validateCurrentStep();
    if (isValid) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrev = () => {
    setCurrentStep(currentStep - 1);
  };

  const handleSubmit = async () => {
    try {
      const isValid = await validateCurrentStep();
      if (isValid) {
        const values = await form.validateFields();
        onFinish(values);
      }
    } catch (errorInfo) {
      console.log("Validation failed:", errorInfo);
    }
  };

  const renderMobileForm = () => {
    return (
      <div className="register-mobile-container">
        <div className="flex justify-center mb-3">
          <Steps
            current={currentStep}
            size="small"
            items={steps.map((step) => ({ title: step.title }))}
            style={{ maxWidth: "100%", padding: "0 10px" }}
          />
        </div>

        <div className="form-section">
          <h2 className="section-header">{steps[currentStep].title}</h2>

          {/* Step 1: Basic Info */}
          {currentStep === 0 && (
            <>
              <Form.Item
                label="First Name"
                name="firstName"
                rules={[
                  {
                    required: true,
                    message: "Please input your first name!",
                  },
                  {
                    pattern: /^[A-Za-z\s]{1,50}$/,
                    message: "First name must be 1-50 letters only.",
                  },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Last Name"
                name="lastName"
                rules={[
                  {
                    required: true,
                    message: "Please input your last name!",
                  },
                  {
                    pattern: /^[A-Za-z\s]{1,50}$/,
                    message: "Last name must be 1-50 letters only.",
                  },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Email"
                name="email"
                rules={[
                  {
                    required: true,
                    message: "Please input your email!",
                  },
                  {
                    type: "email",
                    message: "Please input a valid email!",
                  },
                ]}
              >
                <Input />
              </Form.Item>

              <Form.Item
                label="Mobile"
                name="phoneNumber"
                rules={[
                  {
                    required: true,
                    message: "Please input your phone number!",
                  },
                  {
                    pattern: /^\d{10,15}$/,
                    message: "Phone number must be 10-15 digits.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </>
          )}

          {/* Step 2: Address */}
          {currentStep === 1 && (
            <>
              <Form.Item
                label="Address"
                name="address"
                rules={[
                  {
                    required: true,
                    message: "Please input your address!",
                  },
                  {
                    pattern: /^[A-Za-z0-9\s,.'-]{1,100}$/,
                    message:
                      "Address must be 1-100 characters long and not contain special characters.",
                  },
                ]}
              >
                <Input.TextArea rows={4} />
              </Form.Item>
            </>
          )}

          {/* Step 3: Identification */}
          {currentStep === 2 && (
            <>
              <Form.Item
                label="Identification Type"
                name="identificationType"
                rules={[
                  {
                    required: true,
                    message: "Please choose an identification type!",
                  },
                ]}
              >
                <Select>
                  <Select.Option value="NATIONAL ID">National ID</Select.Option>
                  <Select.Option value="PASSPORT">Passport</Select.Option>
                  <Select.Option value="DRIVING LICENSE">
                    Driving License
                  </Select.Option>
                  <Select.Option value="SOCIAL CARD">
                    Social Security Card (SSN)
                  </Select.Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Identification Number"
                name="identificationNumber"
                rules={[
                  {
                    required: true,
                    message: "Please input your identification number!",
                  },
                  {
                    pattern: /^[A-Za-z0-9]{1,20}$/,
                    message:
                      "Identification number must be 1-20 alphanumeric characters.",
                  },
                ]}
              >
                <Input />
              </Form.Item>
            </>
          )}

          {/* Step 4: Security */}
          {currentStep === 3 && (
            <>
              <Form.Item
                label="Password"
                name="password"
                hasFeedback
                rules={[
                  {
                    required: true,
                    message: "Please input your password!",
                  },
                  {
                    pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
                    message:
                      "Password must be at least 8 characters long and include letters and numbers.",
                  },
                ]}
              >
                <Input.Password />
              </Form.Item>

              <Form.Item
                label="Confirm Password"
                name="confirmPassword"
                hasFeedback
                dependencies={["password"]}
                rules={[
                  {
                    required: true,
                    message: "Please confirm your password!",
                  },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue("password") === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(
                        new Error("The passwords do not match!")
                      );
                    },
                  }),
                ]}
              >
                <Input.Password />
              </Form.Item>
            </>
          )}
        </div>

        <div className="flex justify-between mt-3">
          {currentStep > 0 && (
            <button
              className="primary-outlined-btn"
              onClick={handlePrev}
              style={{
                width:
                  currentStep === steps.length - 1 ? "48%" : "100%",
              }}
            >
              Previous
            </button>
          )}

          {currentStep < steps.length - 1 ? (
            <button
              className="primary-contained-btn"
              onClick={handleNext}
              style={{
                width: currentStep > 0 ? "48%" : "100%",
              }}
            >
              Next
            </button>
          ) : (
            <button
              className="primary-contained-btn"
              onClick={handleSubmit}
              style={{ width: "48%" }}
            >
              Register
            </button>
          )}
        </div>

        <div className="mt-3 text-center">
          <h1
            className="text-sm underline"
            onClick={() => navigate("/login")}
          >
            Already a member? Click here to login
          </h1>
        </div>
      </div>
    );
  };

  const renderDesktopForm = () => {
    return (
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
                {
                  pattern: /^[A-Za-z\s]{1,50}$/,
                  message: "First name must be 1-50 letters only.",
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
                {
                  pattern: /^[A-Za-z\s]{1,50}$/,
                  message: "Last name must be 1-50 letters only.",
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
                {
                  type: "email",
                  message: "Please input a valid email!",
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
                {
                  pattern: /^\d{10,15}$/,
                  message: "Phone number must be 10-15 digits.",
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
                {
                  pattern: /^[A-Za-z0-9\s,.'-]{1,100}$/,
                  message:
                    "Address must be 1-100 characters long and not contain special characters.",
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
                  message: "Please choose an identification type!",
                },
              ]}
            >
              <Select>
                <Select.Option value="NATIONAL ID">National ID</Select.Option>
                <Select.Option value="PASSPORT">Passport</Select.Option>
                <Select.Option value="DRIVING LICENSE">
                  Driving License
                </Select.Option>
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
                {
                  pattern: /^[A-Za-z0-9]{1,20}$/,
                  message:
                    "Identification number must be 1-20 alphanumeric characters.",
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
              hasFeedback
              rules={[
                {
                  required: true,
                  message: "Please input your password!",
                },
                {
                  pattern: /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/,
                  message:
                    "Password must be at least 8 characters long and include letters and numbers.",
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
              hasFeedback
              dependencies={["password"]}
              rules={[
                {
                  required: true,
                  message: "Please confirm your password!",
                },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    if (!value || getFieldValue("password") === value) {
                      return Promise.resolve();
                    }
                    return Promise.reject(new Error("The passwords do not match!"));
                  },
                }),
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
          className="text-sm underline mt-2 text-center"
          onClick={() => navigate("/login")}
        >
          Already a member? Click here to login
        </h1>
      </Form>
    );
  };

  return (
    <div className="bg-primary flex items-center justify-center h-screen">
      <div
        className={`card ${
          isMobile ? "sm-w-100 register-mobile-card" : "w-800 p-2"
        }`}
      >
        <div className="flex items-center justify-between mb-2">
          <h1
            className={`${
              isMobile ? "text-lg sm-text-center w-100" : "text-xl"
            }`}
          >
            WALLETXCHANGE - REGISTER
          </h1>
        </div>
        <hr />

        <Form form={form} layout="vertical" initialValues={{}} className="mt-3">
          {isMobile ? renderMobileForm() : renderDesktopForm()}
        </Form>
      </div>
    </div>
  );
}

export default Register;
