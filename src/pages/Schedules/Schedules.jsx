import { Component } from 'react';

class Schedules extends Component {
  constructor(props) {
    super(props);
    this.state = {
      currentDay: new Date().getDay(),
    };
  }

  render() {
    const { currentDay } = this.state;
    return (
      <div>{currentDay}</div>
    );
  }
}

export default Schedules;
