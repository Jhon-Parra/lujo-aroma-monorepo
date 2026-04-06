import { getSitemap } from './src/controllers/sitemap.controller';
import dotenv from 'dotenv';
dotenv.config();

const req = {} as any;
const res = {
    header: () => {},
    status: () => res,
    send: (data: any) => {
        console.log("=== XML OUTPUT ===");
        console.log(data.split('\n').slice(0, 30).join('\n'));
        console.log("...");
        process.exit(0);
    }
} as any;

getSitemap(req, res);
