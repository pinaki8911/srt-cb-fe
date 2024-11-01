import { Camera, CaretRight, ChartLineUp, House } from '@phosphor-icons/react';
import { useNavigate } from 'react-router-dom';

const HomePage = () => {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md space-y-8 rounded-xl bg-white p-8 shadow-lg">
        <div className="space-y-4 text-center">
          <House size={48} weight="duotone" className="mx-auto text-blue-500" />
          <h1 className="text-3xl font-bold text-gray-900">SRT Analysis</h1>
          <p className="text-gray-600">
            Evaluate your mobility and fitness with the Sitting-Rising Test
            (SRT)
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center space-x-4 text-gray-600">
            <div className="flex-shrink-0">
              <Camera size={24} weight="duotone" />
            </div>
            <p>Record your SRT performance</p>
          </div>
          <div className="flex items-center space-x-4 text-gray-600">
            <div className="flex-shrink-0">
              <ChartLineUp size={24} weight="duotone" />
            </div>
            <p>Get instant AI-powered analysis</p>
          </div>
        </div>

        <button
          onClick={() => navigate('/record')}
          className="flex w-full items-center justify-center space-x-2 rounded-lg bg-blue-500 px-4 py-3 text-white transition-colors hover:bg-blue-600"
        >
          <span>Start Recording</span>
          <CaretRight size={20} weight="bold" />
        </button>
      </div>
    </div>
  );
};

export default HomePage;
