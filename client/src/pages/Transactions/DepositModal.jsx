import { Modal, Form, Input, InputNumber, message } from "antd";
import StripeCheckout from "react-stripe-checkout";
import { DepositMoney, VerifyDepositCode } from "../../api/transactions";
import { useDispatch } from "react-redux";
import { HideLoading, ShowLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify"; // For sanitizing data
import { useState } from "react";

function DepositModal({ showDepositModal, setShowDepositModal, reloadData }) {
  const [form] = Form.useForm();
  const dispatch = useDispatch();
  const [verificationCode, setVerificationCode] = useState(""); // State for holding the verification code
  const [showVerificationModal, setShowVerificationModal] = useState(false); // Flag to toggle the verification modal

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
              rules={[
                {
                  required: true,
                  message: "Please input amount",
                },
              ]}
            >
              <InputNumber min={1} controls={false} />
            </Form.Item>

            <div className="flex justify-end gap-1">
              <button
                className="primary-outlined-btn"
                onClick={() => setShowDepositModal(false)}
              >
                Cancel
              </button>
              <StripeCheckout
                token={onToken}
                currency="USD"
                amount={form.getFieldValue("amount") * 100} // Convert to cents for Stripe
                shippingAddress
                stripeKey="pk_test_51P8KILJu27FG0r8818B58hMz1ejeheU6F84tFUXtmcvkRgc4ofbw2zEejUwPTTE38LoqB4GZZBiCVCieIBjkRTXW00fqLAGsNI"
              >
                <button className="primary-contained-btn">Deposit</button>
              </StripeCheckout>
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
    </>
  );
}

export default DepositModal;
