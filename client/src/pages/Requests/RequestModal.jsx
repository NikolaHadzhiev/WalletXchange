import { useState, useEffect } from "react";
import { Modal, Form, message, Input, InputNumber } from "antd";
import { useDispatch, useSelector } from "react-redux";
import { VerifyAccount } from "../../api/transactions";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import { SendRequest } from "../../api/requests";
import DOMPurify from "dompurify"; // Import DOMPurify for sanitization

function RequestModal({
  showNewRequestModal,
  setShowNewRequestModal,
  reloadData,
}) {
  const { TextArea } = Input;
  const [form] = Form.useForm();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.users);
  const [isVerified, setIsVerified] = useState("");
  const [isReceiverValid, setIsReceiverValid] = useState(false);

  const verifyAccount = async () => {
    try {
      dispatch(ShowLoading());

      const response = await VerifyAccount({
        receiver: DOMPurify.sanitize(form.getFieldValue("receiver")),
      });

      dispatch(HideLoading());

      if (response.success) {
        setIsVerified("yes");
      } else {
        setIsVerified("no");

        if (!response.data) {
          message.error(response.message);
        }
      }
    } catch (error) {
      dispatch(HideLoading());
      setIsVerified("no");
    }
  };

  const validateReceiver = (receiverAccount) => {
    // Regular expression to ensure no special characters or spaces are present
    const isValid = /^[a-zA-Z0-9]+$/.test(receiverAccount) && receiverAccount.trim() !== "";
    setIsReceiverValid(isValid);
  };

  const onFinish = async (values) => {
    try {
      dispatch(ShowLoading());

      // Sanitizing inputs before sending them
      const sanitizedReceiver = DOMPurify.sanitize(form.getFieldValue("receiver").trim()); // Remove any unwanted spaces
      const sanitizedDescription = DOMPurify.sanitize(values.reference || ""); // Sanitize description to avoid XSS
      const sanitizedAmount = Math.abs(values.amount); // Ensure amount is a positive number

      const payload = {
        ...values,
        sender: user._id,
        status: "success",
        reference: sanitizedDescription, // Use sanitized description
        receiver: sanitizedReceiver, // Use sanitized receiver
        amount: sanitizedAmount, // Ensure amount is sanitized
      };

      const response = await SendRequest(payload);

      if (response.success) {
        reloadData();
        setShowNewRequestModal(false);
        message.success(response.message);
      } else {
        setShowNewRequestModal(false);
        message.error(response.message);
      }

      dispatch(HideLoading());
    } catch (error) {
      message.error(error.message);
      dispatch(HideLoading());
    }
  };

  useEffect(() => {
    form.setFieldsValue({ receiver: "", amount: "", reference: "" }); // Reset fields when modal is opened
  }, [showNewRequestModal]);

  return (
    <div>
      <Modal
        title="Request Money"
        open={showNewRequestModal}
        onCancel={() => setShowNewRequestModal(false)}
        onClose={() => setShowNewRequestModal(false)}
        footer={null}
      >
        <Form layout="vertical" form={form} onFinish={onFinish}>
          <div className="flex gap-2 items-center">
            <Form.Item
              label="Account Number"
              name="receiver"
              className="w-100"
              rules={[
                {
                  required: true,
                  message: "Please input your receiver!",
                },
                {
                  pattern: /^[a-zA-Z0-9]*$/, // Validate no special characters
                  message: "Forbidden characters.",
                },
              ]}
            >
              <Input
                onChange={(e) => validateReceiver(e.target.value)} // Validate receiver on input change
              />
            </Form.Item>
            <button
              className={`primary-contained-btn mt-1 ${
                !isReceiverValid ? "grayed-out" : ""
              }`}
              type="button"
              onClick={verifyAccount}
              disabled={!isReceiverValid} // Disable "VERIFY" button if receiver is not valid
            >
              VERIFY
            </button>
          </div>

          {isVerified === "yes" && (
            <div className="success-bg">Account verified successfully</div>
          )}

          {isVerified === "no" && (
            <div className="error-bg">Invalid Account</div>
          )}

          <Form.Item
            label="Amount"
            name="amount"
            rules={[
              {
                required: true,
                message: "Please input your amount!",
              },
            ]}
          >
            <InputNumber min={1} step={0.01} controls={false} />
          </Form.Item>

          <Form.Item label="Description" name="reference">
            <TextArea rows={4} />
          </Form.Item>

          <div className="flex justify-end gap-1">
            <button
              className="primary-outlined-btn"
              onClick={() => setShowNewRequestModal(false)}
            >
              Cancel
            </button>
            {isVerified === "yes" && (
              <button className="primary-contained-btn" type="submit">
                Request
              </button>
            )}
          </div>
        </Form>
      </Modal>
    </div>
  );
}

export default RequestModal;
