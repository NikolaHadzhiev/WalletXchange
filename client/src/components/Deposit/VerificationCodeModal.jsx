import { Modal, Form, Input, message } from "antd";

const VerificationCodeModal = ({ 
  isVisible, 
  title,
  onCancel,
  onVerify,
  verificationCode,
  setVerificationCode,
  requestVerificationCode = null,
  showRequestButton = false
}) => {
  const handleCancel = () => {
    Modal.confirm({
      title: "Cancel Deposit",
      content: "Are you sure you want to cancel your deposit?",
      okText: "Yes",
      cancelText: "No",
      onOk: () => {
        onCancel();
        sessionStorage.removeItem('pendingPayPalDeposit');
        message.info("Deposit was cancelled.");
      }
    });
  };

  return (
    <Modal
      title={title || "Enter Verification Code"}
      open={isVisible}
      onCancel={onCancel}
      footer={null}
    >
      <Form layout="vertical">
        {showRequestButton && requestVerificationCode && (
          <div className="mb-4">
            <p>After reviewing your order, click the button below to request a verification code:</p>
            <button
              className="primary-contained-btn w-full"
              onClick={requestVerificationCode}
            >
              Request Verification Code
            </button>
          </div>
        )}
        
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
            placeholder="Enter the code sent to your email"
          />
        </Form.Item>
        <div className="flex justify-end gap-1">
          <button
            className="primary-outlined-btn"
            onClick={handleCancel}
          >
            Cancel
          </button>
          <button
            className="primary-contained-btn"
            onClick={onVerify}
          >
            Verify & Complete Payment
          </button>
        </div>
      </Form>
    </Modal>
  );
};

export default VerificationCodeModal;
