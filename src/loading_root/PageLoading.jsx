import React from 'react';

import './css/pageloading.css';
import Loader from './components/Loader';

function PageLoading() {
  return (
    <div className='pageloading'>
      <Loader />
    </div>
  );
}

export default PageLoading;
