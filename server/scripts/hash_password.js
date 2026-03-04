import bcrypt from 'bcryptjs';

const password = 'I9oki9ok';
const saltRounds = 12;

bcrypt.hash(password, saltRounds).then(hash => {
    console.log(hash);
});
