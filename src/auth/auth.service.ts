import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { UserRepository } from './users.repository';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from './user.entity';
import { AuthCredentialsDto } from './dto/auth-credentials.dto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { Role } from 'src/role/role.entity';
import { Repository } from 'typeorm';
import { RoleService } from 'src/role/role.service';

interface AuthResponse {
  access_token: string | null;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User) private usersRepository: UserRepository,
    @InjectRepository(Role) private roleRepository: Repository<Role>,
    private roleService: RoleService,
    private jwt: JwtService,
  ) {}

  async signUp(authCredentials: AuthCredentialsDto): Promise<void> {
    const { username, password } = authCredentials;
    const salt = await bcrypt.genSalt();
    const hashedPass = await bcrypt.hash(password, salt);
    const user = this.usersRepository.create({
      username,
      password: hashedPass,
    });
    await this.usersRepository
      .save(user)
      .then((res) => {})
      .catch((err) => {
        if (err.code === '23505') {
          throw new ConflictException('username Already Exists');
        } else {
          new InternalServerErrorException();
        }
      });
  }

  async login(user: any): Promise<{ access_token: string }> {
    const payload = { username: user.username };
    return {
      access_token: this.jwt.sign(payload),
    };
  }

  async signIn(AuthCredentials: AuthCredentialsDto): Promise<AuthResponse> {
    const { username, password } = AuthCredentials;

    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user) {
      throw new Error('User not found');
    }

    const passCheck = await bcrypt.compare(password, user.password);

    if (passCheck === true) {
      const { password, id, ...result } = user;
      return await this.login(result);
    } else {
      throw new Error('Password Mismatch');
    }
  }

  async assignRolesToUsers(
    userId: string,
    roleId: number[],
  ): Promise<User | Role[]> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found');
    }

    const roles = await this.roleService.findByIds(roleId);
    if (roles.length !== roleId.length) {
      throw new Error('Some roles not found');
    }

    user.roles = roles;
    return this.usersRepository.save(user);
  }
}