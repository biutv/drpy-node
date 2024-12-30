// 接口basic验证
export const validateBasicAuth = (request, reply, done) => {
    // console.log('进入了basic验证');
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        reply.header('WWW-Authenticate', 'Basic');
        return reply.code(401).send('Authentication required');
    }

    const base64Credentials = authHeader.split(' ')[1];
    const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
    const [username, password] = credentials.split(':');

    const validUsername = process.env.API_AUTH_NAME || '';
    const validPassword = process.env.API_AUTH_CODE || '';

    if (username === validUsername && password === validPassword) {
        done(); // 验证通过，继续处理请求
    } else {
        reply.header('WWW-Authenticate', 'Basic');
        return reply.code(401).send('Invalid credentials');
    }
};

// 接口密码验证
export const validatePwd = async (request, reply) => {
    const apiPwd = process.env.API_PWD;
    if (!apiPwd) {
        return; // 如果未配置 API_PWD，直接通过
    }

    // 从查询参数或请求体中获取 pwd
    const pwd = request.query.pwd || request.body?.pwd;

    // 如果 pwd 不存在或与 API_PWD 不匹配，返回 403
    if (pwd !== apiPwd) {
        return reply.code(403).send({error: 'Forbidden: Invalid or missing pwd'});
    }
};
