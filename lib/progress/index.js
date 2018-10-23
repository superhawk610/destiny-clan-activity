const Gauge = require('gauge');

let gauge;
let message;
let completedRequests;
let totalRequests;
let completedMembers;
let totalMembers;

const init = () => {
  gauge = new Gauge();
  message = '';
  completedRequests = 0;
  totalRequests = 0;
  completedMembers = 0;
  totalMembers = 0;
};

const update = () => {
  // TODO: this should work but for some reason shows many more requests than are actually sent
  // message = `${completedRequests} / ${totalRequests} requests completed
  // (${completedMembers} / ${totalMembers} characters)`;
  message = `${completedMembers} / ${totalMembers} characters`;
  gauge.show(message, completedMembers / totalMembers);
};

const addRequest = (number = 1) => {
  totalRequests += number;
  update();
};

const completeRequest = () => {
  completedRequests++;
  update();
};

const addMember = () => totalMembers++;

const completeMember = () => completedMembers++;

module.exports.init = init;
module.exports.addRequest = addRequest;
module.exports.completeRequest = completeRequest;
module.exports.addMember = addMember;
module.exports.completeMember = completeMember;
