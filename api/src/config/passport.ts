import { PassportStatic } from 'passport';
import { Strategy as JwtStrategy, ExtractJwt, StrategyOptions } from 'passport-jwt';
import { Strategy as LocalStrategy } from 'passport-local';
import bcrypt from 'bcryptjs';
import { prisma } from './database.js';

export const configurePassport = (passport: PassportStatic): void => {
  // JWT Strategy - for protected routes
  const jwtOptions: StrategyOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    secretOrKey: process.env.JWT_SECRET || 'default-secret',
  };

  passport.use(
    new JwtStrategy(jwtOptions, async (payload, done) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            email: true,
            name: true,
            avatarUrl: true,
            createdAt: true,
          },
        });

        if (user) {
          return done(null, user);
        }
        return done(null, false);
      } catch (error) {
        return done(error, false);
      }
    })
  );

  // Local Strategy - for login
  passport.use(
    new LocalStrategy(
      {
        usernameField: 'email',
        passwordField: 'password',
      },
      async (email, password, done) => {
        try {
          const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() },
          });

          if (!user) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          const isMatch = await bcrypt.compare(password, user.password);
          if (!isMatch) {
            return done(null, false, { message: 'Invalid email or password' });
          }

          // Don't return password
          const { password: _, ...userWithoutPassword } = user;
          return done(null, userWithoutPassword);
        } catch (error) {
          return done(error);
        }
      }
    )
  );
};
