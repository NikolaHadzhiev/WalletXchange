import { Card, Button, Space, Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';

const { Title, Paragraph } = Typography;

function DDoSProtectionPage() {
  const navigate = useNavigate();

  // Redirect to the homepage or any other desired page
  const handleGoHome = () => {
    navigate('/');
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', backgroundColor: '#f5f5f5' }}>
      <Card
        style={{ width: 400, textAlign: 'center' }}
        bordered={false}
        title="DDoS Protection"
        headStyle={{ backgroundColor: '#f0f2f5', fontWeight: 'bold' }}
      >
        <Title level={3}>Too Many Requests</Title>
        <Paragraph>
          We are sorry, but you have made too many requests in a short period of time. Please try again later. 
        </Paragraph>
        <Paragraph>
          If you continue to experience issues, feel free to contact support.
        </Paragraph>
        <Space size="large">
          <Button
            type="primary"
            icon={<HomeOutlined />}
            onClick={handleGoHome}
          >
            Go to Home
          </Button>
        </Space>
      </Card>
    </div>
  );
}

export default DDoSProtectionPage;
