// Demo page: shows the app in a phone frame and lists the content it loads from the site.
// On a phone, open the app itself.
if (window.matchMedia('(max-width: 599px)').matches) window.location.replace('app/');

const frame = document.getElementById('app');
const requests = document.getElementById('requests');

window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin || event.data?.type !== 'content-request') return;
  const { path, status, ms } = event.data;
  const item = document.createElement('li');
  item.append(
    Object.assign(document.createElement('span'), { className: 'status', textContent: status || '' }),
    Object.assign(document.createElement('span'), { className: 'path', textContent: path }),
    Object.assign(document.createElement('span'), { className: 'ms', textContent: `${ms} ms` }),
  );
  requests.prepend(item);
  while (requests.children.length > 20) requests.lastElementChild.remove();
});

document.getElementById('reload').addEventListener('click', () => {
  requests.replaceChildren();
  frame.contentWindow.location.reload();
});
