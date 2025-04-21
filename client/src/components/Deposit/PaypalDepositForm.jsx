import { useState } from "react";
import { message } from "antd";
import { useDispatch } from "react-redux";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify";
import { CreatePaypalOrder } from "../../api/transactions";
import { encryptData } from "../../utils/cryptoUtils";

const PaypalDepositForm = ({ form, user, onPaypalOrderCreated }) => {
  const dispatch = useDispatch();
  const [paypalLoading, setPaypalLoading] = useState(false);

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
      
      // Create encrypted state with HMAC
      const stateData = {
        amount,
        ts: Date.now(),
        uid: user._id
      };
      
      // Encrypt the state
      const encryptedState = encryptData(stateData);
      
      const baseUrl = window.location.origin + window.location.pathname;
      const returnUrl = `${baseUrl}?paypal=success&state=${encodeURIComponent(encryptedState)}`;
      const cancelUrl = `${baseUrl}?paypal=cancel`;

      const response = await CreatePaypalOrder({ 
        amount, 
        userId: user._id,
        returnUrl,
        cancelUrl
      });
      // Encrypt the order ID before storing
      const encryptedOrderId = encryptData(response.orderID);
      if (!encryptedOrderId) {
        setPaypalLoading(false);
        dispatch(HideLoading());
        message.error('Failed to encrypt order data. Please try again.');
        return;
      }
      
      // Store encrypted order ID
      sessionStorage.setItem('paypalOrderId', encryptedOrderId);
      
      dispatch(HideLoading());
      setPaypalLoading(false);
      
      if (response.success && response.orderID && response.approvalUrl) {
        message.success("PayPal order created. You will be redirected to PayPal.");
        onPaypalOrderCreated(response.orderID);
        window.location.href = response.approvalUrl;
      } else {
        message.error(response.message || "Failed to create PayPal order");
      }
    } catch (error) {
      setPaypalLoading(false);
      dispatch(HideLoading());
      message.error(DOMPurify.sanitize(error.message));
    }
  };

  return (
    <>
      <button
        className="primary-contained-btn"
        onClick={handlePaypalDeposit}
        disabled={paypalLoading}
      >
        {paypalLoading ? 'Processing...' : 'Deposit with PayPal'}
      </button>
    </>
  );
};

export default PaypalDepositForm;
