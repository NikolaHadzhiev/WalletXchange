import { useRef } from "react";
import { message } from "antd";
import { useDispatch } from "react-redux";
import StripeCheckout from "react-stripe-checkout";
import { DepositMoney } from "../../api/transactions";
import { ShowLoading, HideLoading } from "../../state/loaderSlice";
import DOMPurify from "dompurify";

const StripeDepositForm = ({ form, onDepositSuccess }) => {
  const dispatch = useDispatch();
  const stripeCheckoutRef = useRef(null);

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
        onDepositSuccess(); // Show the verification modal once the deposit request is successful
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

  const handleStripeCheckout = () => {
    const amount = form.getFieldValue("amount");
    if (!amount || amount <= 0) {
      message.error("Please enter a valid amount.");
      return false;
    }
    return true;
  };

  return (
    <>
      <button 
        className="primary-contained-btn" 
        onClick={() => {
          if(handleStripeCheckout()) {
            stripeCheckoutRef.current && stripeCheckoutRef.current.onClick();
          }
        }}
      >
        Deposit
      </button>
      <div style={{display: 'none'}}>
        <StripeCheckout
          ref={stripeCheckoutRef}
          token={onToken}
          currency="USD"
          amount={(form.getFieldValue("amount") || 0) * 100}
          shippingAddress
          stripeKey="pk_test_51P8KILJu27FG0r8818B58hMz1ejeheU6F84tFUXtmcvkRgc4ofbw2zEejUwPTTE38LoqB4GZZBiCVCieIBjkRTXW00fqLAGsNI"
        >
          <button>Hidden</button>
        </StripeCheckout>
      </div>
    </>
  );
};

export default StripeDepositForm;
