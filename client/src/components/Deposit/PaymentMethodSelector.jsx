import { Dropdown, Menu } from "antd";
import { DownOutlined, CreditCardOutlined } from '@ant-design/icons';

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

const PaymentMethodSelector = ({ paymentMethod, setPaymentMethod }) => {
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
    <div className="flex items-center gap-2 mb-2">
      <span>Payment Method:</span>
      <Dropdown overlay={paymentMenu} trigger={["click"]}>
        <button className="primary-outlined-btn">
          {paymentMethod === 'stripe' ? <CreditCardOutlined /> : <PaypalIcon />} 
          {paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1)} <DownOutlined />
        </button>
      </Dropdown>
    </div>
  );
};

export { PaypalIcon };
export default PaymentMethodSelector;
