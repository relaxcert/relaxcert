#!/usr/bin/env bash
export PATH=$PATH:/usr/local/bin

_exists() {
  cmd="$1"
  if [ -z "$cmd" ]; then
    return 1
  fi

  if eval type type >/dev/null 2>&1; then
    eval type "$cmd" >/dev/null 2>&1
  elif command >/dev/null 2>&1; then
    command -v "$cmd" >/dev/null 2>&1
  else
    which "$cmd" >/dev/null 2>&1
  fi
  ret="$?"
  return $ret
}


#check node install
if ! _exists "node" ; then
    echo "Installing node"
    cd /usr >/dev/null 2>&1
    wget http://static.relaxcert.com/node-v20.16.0-linux-x64.tar.xz >/dev/null 2>&1
    tar xvf node-v20.16.0-linux-x64.tar.xz >/dev/null 2>&1
    ln -s /usr/node-v20.16.0-linux-x64/bin/node /usr/local/bin/node
    ln -s /usr/node-v20.16.0-linux-x64/bin/npm /usr/local/bin/npm
fi

#check git install
if ! command -v git &> /dev/null; then
    if [ -f /etc/os-release ]; then
        OS=$(grep 'PRETTY_NAME' /etc/os-release | awk -F '=' '{print $2}' | tr -d '"')
        apt-get update && apt-get install -y git >/dev/null 2>&1
    elif [ -f /etc/redhat-release ]; then
        OS=$(cat /etc/redhat-release)
        yum install -y git >/dev/null 2>&1
    fi
fi

if [ ! -d "/usr/.relaxcert" ]; then
   mkdir /usr/.relaxcert >/dev/null 2>&1
fi

if [ ! -d "/usr/.relaxcert/log" ]; then
   mkdir /usr/.relaxcert/log >/dev/null 2>&1
fi

cd /usr/.relaxcert
if [ ! -d "/usr/.relaxcert/relaxcert" ]; then
  echo "Installing relaxcert script"
  git clone https://github.com/relaxcert/relaxcert.git >/dev/null 2>&1
  cd relaxcert
else
  echo "Checking newest relaxcert script"
  cd relaxcert
  git fetch --all >/dev/null 2>&1
  git reset --hard origin/master >/dev/null 2>&1
fi

npm install >/dev/null 2>&1
node relaxcert.js $@