import { useState } from "react";
import { message, Input, Modal } from "antd";
import { useDispatch } from "react-redux";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify";
import { RequestPaypalWithdrawal, VerifyPaypalWithdrawal } from "../../api/transactions";

const PaypalWithdrawalForm = ({ form, user, onSuccess }) => {
  const dispatch = useDispatch();
  const [paypalLoading, setPaypalLoading] = useState(false);
  const [verificationVisible, setVerificationVisible] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [withdrawalDetails, setWithdrawalDetails] = useState(null);

  // Handle the initial withdrawal request
  const handlePaypalWithdrawal = async () => {
    try {
      await form.validateFields(['amount', 'paypalEmail']);
      const amount = form.getFieldValue("amount");
      const paypalEmail = form.getFieldValue("paypalEmail");
      
      if (amount <= 0) {
        message.error("Please enter a valid amount.");
        return;
      }
      
      if (amount > user.balance) {
        message.error("Insufficient balance for this withdrawal.");
        return;
      }

      setPaypalLoading(true);
      dispatch(ShowLoading());

      const response = await RequestPaypalWithdrawal({ 
        userId: user._id,
        amount,
        paypalEmail
      });
      
      setPaypalLoading(false);
      dispatch(HideLoading());
      
      if (response.success) {
        message.success("Verification code sent to your email.");
        setWithdrawalDetails({ amount, paypalEmail });
        setVerificationVisible(true);
      } else {
        message.error(response.message || "Failed to request withdrawal");
      }
    } catch (error) {
      setPaypalLoading(false);
      dispatch(HideLoading());
      message.error(DOMPurify.sanitize(error.message) || "Please fill all required fields");
    }
  };

  // Handle verification code submission
  const handleVerificationSubmit = async () => {
    if (!verificationCode || verificationCode.length < 6) {
      message.error("Please enter a valid verification code");
      return;
    }

    try {
      dispatch(ShowLoading());
      
      const response = await VerifyPaypalWithdrawal({
        userId: user._id,
        verificationCode,
        amount: withdrawalDetails.amount,
        paypalEmail: withdrawalDetails.paypalEmail
      });
      
      dispatch(HideLoading());
      
      if (response.success) {
        message.success("Withdrawal processed successfully");
        setVerificationVisible(false);
        setVerificationCode("");
        setWithdrawalDetails(null);
        form.resetFields();
        if (onSuccess) onSuccess();
      } else {
        message.error(response.message || "Failed to verify withdrawal");
      }
    } catch (error) {
      dispatch(HideLoading());
      message.error(DOMPurify.sanitize(error.message));
    }
  };

  return (
    <>
      <button
        className="primary-contained-btn"
        onClick={handlePaypalWithdrawal}
        disabled={paypalLoading}
      >
        {paypalLoading ? 'Processing...' : 'Withdraw to PayPal'}
      </button>

      {/* Verification Code Modal */}
      <Modal
        title="Verification Required"
        open={verificationVisible}
        onCancel={() => setVerificationVisible(false)}
        onOk={handleVerificationSubmit}
        okText="Verify and Withdraw"
        cancelText="Cancel"
      >
        <div className="flex flex-col">
          <p>
            A verification code has been sent to your email. Please enter it below 
            to complete your withdrawal of ${withdrawalDetails?.amount} to {withdrawalDetails?.paypalEmail}.
          </p>
          <Input
            placeholder="Verification Code"
            value={verificationCode}
            onChange={(e) => setVerificationCode(e.target.value)}
            className="mt-2"
            maxLength={6}
          />
        </div>
      </Modal>
    </>
  );
};

export default PaypalWithdrawalForm;
