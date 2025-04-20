import { Modal, Form, Input, InputNumber, message, Dropdown, Menu } from "antd";
import { DownOutlined, CreditCardOutlined } from '@ant-design/icons';
import { CreatePaypalOrder, VerifyPaypalDeposit, DepositMoney, VerifyDepositCode } from "../../api/transactions";
import { useDispatch, useSelector } from "react-redux";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify"; // For sanitizing data
import { useState, useEffect } from "react";
import StripeCheckout from "react-stripe-checkout";

function DepositModal({ showDepositModal, setShowDepositModal, reloadData }) {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.users);

  const [verificationCode, setVerificationCode] = useState(""); // State for holding the verification code
  const [showVerificationModal, setShowVerificationModal] = useState(false); // Flag to toggle the verification modal
  const [paymentMethod, setPaymentMethod] = useState("stripe");
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [paypalOrderId, setPaypalOrderId] = useState(null);
  const [showPaypalVerificationModal, setShowPaypalVerificationModal] = useState(false);
  const [paypalVerificationCode, setPaypalVerificationCode] = useState("");

  // Set the email value in the form when user data is available or when modal becomes visible
  useEffect(() => {
    if (user?.email && showDepositModal) {
      form.setFieldsValue({ 
        paypalEmail: user.email 
      });
    }
  }, [user, showDepositModal, form]);

  const onToken = async (token) => {
    try {
      // Validate the amount before proceeding
      const amount = form.getFieldValue("amount");
      if (!amount || amount <= 0) {
        message.error("Please enter a valid amount.");
        return;
      }

      dispatch(ShowLoading());

      // Send deposit request to server, this will send the code to the user's email
      const response = await DepositMoney({
        token,
        amount,
      });

      dispatch(HideLoading());

      // Sanitize response message to prevent XSS
      const sanitizedMessage = DOMPurify.sanitize(response.message);

      if (response.success) {
        setShowVerificationModal(true); // Show the verification modal once the deposit request is successful
        message.success(sanitizedMessage);
      } else {
        message.error(sanitizedMessage);
      }
    } catch (error) {
      dispatch(HideLoading());

      // Sanitize error message to avoid exposing sensitive info
      const sanitizedErrorMessage = DOMPurify.sanitize(error.message);
      message.error(sanitizedErrorMessage);
    }
  };

  const handleVerifyCode = async () => {
    try {
      if (!verificationCode) {
        message.error("Please enter the verification code.");
        return;
      }

      // Verify the code entered by the user
      dispatch(ShowLoading());

      const response = await VerifyDepositCode({
        verificationCode,
        amount: form.getFieldValue("amount"),
      });

      dispatch(HideLoading());

      if (response.success) {
        reloadData(); // Reload data to reflect changes
        setShowDepositModal(false); // Close the deposit modal
        setShowVerificationModal(false); // Close the verification modal
        message.success("Deposit successful!");
      } else {
        message.error("Verification failed. Please check your code and try again.");
      }
    } catch (error) {
      dispatch(HideLoading());
      const sanitizedErrorMessage = DOMPurify.sanitize(error.message);
      message.error(sanitizedErrorMessage);
    }
  };
  // PayPal handlers (with verification)
  const handlePaypalDeposit = async () => {
    try {
      const amount = form.getFieldValue("amount");
      const email = form.getFieldValue("paypalEmail");
      if (!amount || amount <= 0) {
        message.error("Please enter a valid amount.");
        return;
      }
      if (!email) {
        message.error("Please enter your PayPal email.");
        return;
      }
      setPaypalLoading(true);
      dispatch(ShowLoading());
      const response = await CreatePaypalOrder({ amount, userId: user._id, email });
      dispatch(HideLoading());
      setPaypalLoading(false);
      if (response.success && response.orderID) {
        setPaypalOrderId(response.orderID);
        setShowPaypalVerificationModal(true);
        message.success("Verification code sent to your email. Complete payment in PayPal and enter the code.");
        window.open(
          `https://www.sandbox.paypal.com/checkoutnow?token=${response.orderID}`,
          '_blank',
          'width=500,height=700'
        );
      } else {
        message.error(response.message || "Failed to create PayPal order");
      }
    } catch (error) {
      setPaypalLoading(false);
      dispatch(HideLoading());
      message.error(DOMPurify.sanitize(error.message));
    }
  };

  const handlePaypalVerifyCode = async () => {
    try {
      if (!paypalVerificationCode) {
        message.error("Please enter the verification code.");
        return;
      }

      dispatch(ShowLoading());

      const response = await VerifyPaypalDeposit({
        userId: user._id,
        verificationCode: paypalVerificationCode,
        amount: form.getFieldValue("amount"),
        orderID: paypalOrderId,
      });

      dispatch(HideLoading());
      
      if (response.success) {
        reloadData();
        setShowDepositModal(false);
        setShowPaypalVerificationModal(false);
        message.success("PayPal deposit successful!");
      } else {
        message.error(response.message || "Verification failed. Please check your code and try again.");
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(DOMPurify.sanitize(error.message));
    }
  };

  // Custom PayPal SVG icon
  const PaypalIcon = () => (
    <svg width="1em" height="1em" viewBox="0 0 32 32" fill="none" style={{ verticalAlign: 'middle' }}>
      <g>
        <path d="M28.5 8.5c-1.1-1.3-2.7-2-4.7-2H10.2c-.7 0-1.3.5-1.4 1.2L5.1 25.2c-.1.5.3.9.8.9h4.2l.7-4.2c.1-.7.7-1.2 1.4-1.2h2.2c5.2 0 9.3-2.1 10.5-8.1.3-1.5.1-2.7-.6-3.6z" fill="#0070ba"/>
        <path d="M25.6 10.2c-.7-.8-1.8-1.2-3.2-1.2H12.7c-.7 0-1.3.5-1.4 1.2l-2.2 12.7c-.1.5.3.9.8.9h3.2l.7-4.2c.1-.7.7-1.2 1.4-1.2h1.2c3.7 0 6.6-1.5 7.5-6 .2-1.1.1-2-.3-2.7z" fill="#003087"/>
        <path d="M20.7 13.2c-.4-.5-1.1-.8-2-.8h-4.2c-.7 0-1.3.5-1.4 1.2l-1.2 6.7c-.1.5.3.9.8.9h2.2l.7-4.2c.1-.7.7-1.2 1.4-1.2h.2c1.7 0 3-.7 3.4-2.6.1-.5.1-1-.1-1.4z" fill="#00b8f0"/>
      </g>
    </svg>
  );

  // Dropdown menu for payment methods
  const paymentMenu = (
    <Menu
      onClick={({ key }) => setPaymentMethod(key)}
      selectedKeys={[paymentMethod]}
      items={[
        {
          key: 'stripe',
          icon: <CreditCardOutlined />,
          label: 'Stripe',
        },
        {
          key: 'paypal',
          icon: <PaypalIcon />,
          label: 'PayPal',
        },
      ]}
    />
  );

  return (
    <>
      <Modal
        title="Deposit"
        open={showDepositModal}
        onCancel={() => setShowDepositModal(false)}
        footer={null}
      >
        <div className="flex-col gap-1">
          <Form layout="vertical" form={form}>
            <Form.Item
              label="Amount"
              name="amount"
              rules={[{ required: true, message: "Please input amount" }]}
            >
              <InputNumber min={1} controls={false} />
            </Form.Item>
            <Form.Item
              label="PayPal Email"
              name="paypalEmail"
              rules={paymentMethod === 'paypal' ? [{ required: true, message: "Please input your PayPal email" }] : []}
              style={{ display: paymentMethod === 'paypal' ? 'block' : 'none' }}
            >              <Input />
            </Form.Item>
            <div className="flex items-center gap-2 mb-2">
              <span>Payment Method:</span>
              <Dropdown overlay={paymentMenu} trigger={["click"]}>
                <button className="primary-outlined-btn">
                  {paymentMethod === 'stripe' ? <CreditCardOutlined /> : <PaypalIcon />} {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} <DownOutlined />
                </button>
              </Dropdown>
            </div>
            <div className="flex justify-end gap-1">
              <button
                className="primary-outlined-btn"
                onClick={() => setShowDepositModal(false)}
              >
                Cancel
              </button>
              {paymentMethod === 'stripe' && (
                <StripeCheckout
                  token={onToken}
                  currency="USD"
                  amount={form.getFieldValue("amount") * 100}
                  shippingAddress
                  stripeKey="pk_test_51P8KILJu27FG0r8818B58hMz1ejeheU6F84tFUXtmcvkRgc4ofbw2zEejUwPTTE38LoqB4GZZBiCVCieIBjkRTXW00fqLAGsNI"
                >
                  <button className="primary-contained-btn">Deposit</button>
                </StripeCheckout>
              )}
              {paymentMethod === 'paypal' && (
                <button
                  className="primary-contained-btn"
                  onClick={handlePaypalDeposit}
                  disabled={paypalLoading}
                >
                  {paypalLoading ? 'Processing...' : 'Deposit with PayPal'}
                </button>
              )}
            </div>
          </Form>
        </div>
      </Modal>
      <Modal
        title="Enter Verification Code"
        open={showVerificationModal}
        onCancel={() => setShowVerificationModal(false)}
        footer={null}
      >
        <Form layout="vertical">
          <Form.Item
            label="Verification Code"
            name="verificationCode"
            rules={[
              {
                required: true,
                message: "Please enter the verification code",
              },
            ]}
          >
            <Input
              value={verificationCode}
              onChange={(e) => setVerificationCode(e.target.value)}
            />
          </Form.Item>
          <div className="flex justify-end gap-1">
            <button
              className="primary-outlined-btn"
              onClick={() => {
                setShowDepositModal(false);
                setShowVerificationModal(false);
              }}
            >
              Cancel
            </button>
            <button
              className="primary-contained-btn"
              onClick={handleVerifyCode}
            >
              Verify Code
            </button>
          </div>
        </Form>
      </Modal>
      <Modal
        title="Enter PayPal Verification Code"
        open={showPaypalVerificationModal}
        onCancel={() => setShowPaypalVerificationModal(false)}
        footer={null}
      >
        <Form layout="vertical">
          <Form.Item
            label="Verification Code"
            name="paypalVerificationCode"
            rules={[{ required: true, message: "Please enter the verification code" }]}
          >
            <Input
              value={paypalVerificationCode}
              onChange={e => setPaypalVerificationCode(e.target.value)}
            />
          </Form.Item>
          <div className="flex justify-end gap-1">
            <button
              className="primary-outlined-btn"
              onClick={() => setShowPaypalVerificationModal(false)}
            >
              Cancel
            </button>
            <button
              className="primary-contained-btn"
              onClick={handlePaypalVerifyCode}
            >
              Verify Code
            </button>
          </div>
        </Form>
      </Modal>
    </>
  );
}

export default DepositModal;
