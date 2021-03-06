import * as Discord from "discord.js";
import { query, close } from "../../util/database";
import { User, UserModel } from "./"

export default class UserManager {
    discordClient: Discord.Client;
    users: Map<string, UserEditable>;

    constructor(bot: Discord.Client) {
        this.discordClient = bot;
        this.users = new Map();
    }
    
    async setSteamID(msg: Discord.Message, id: string) {
        msg.channel.startTyping();
        let rows = await query(`SELECT * FROM steamID WHERE id = '${msg.author.id}'`);
        if (!rows.length) await query(`INSERT INTO steamID (id, tag, steamid) VALUES ('${msg.author.id}', '${msg.author.tag}', '${id}')`);
        else await query(`UPDATE steamID SET steamid = '${id}' WHERE id = '${msg.author.id}'`);
        await close();
        console.log(`Added ${msg.author.tag} to my database with steamid of ${id}`);
        msg.channel.stopTyping(true);
    }

    async getUserLogs(id: string) {
        let rows = await query(`SELECT * FROM logskey WHERE id='${id}'`);
        if (!rows.length) return undefined;
        return rows[0].logskey
    }

    async setLogsKey(id: string, key: string) {
        let rows = await query(`SELECT * FROM logskey WHERE id='${id}'`);
        if (!rows.length) await query(`INSERT INTO logskey (id, logskey) VALUES ('${id}', '${key}')`);
        else await query(`UPDATE logskey SET logskey = '${key}' WHERE id = '${id}'`);
    }

    async findUser(msg: Discord.Message): Promise<string | boolean> {
        let targetUser = msg.mentions.users.first() || msg.author;
        let rows = await query(`SELECT * FROM steamID WHERE id = '${targetUser.id}'`);
        await close();
        if (!rows.length) return false;
        let steamid: string = rows[0].steamid;
        return steamid;
    }

    async getUserLevel(id: string): Promise<number> {
        let rows = await query(`SELECT * FROM changelog_configuration WHERE id = '${id}'`);
        await close();
        if (!rows.length) {
            await query(`INSERT INTO changelog_configuration (id, level) VALUES ('${id}', '2')`);
            let rows = await query(`SELECT * FROM changelog_configuration WHERE id = '${id}'`);
            await close();
            return rows[0].level as number;
        } else return rows[0].level as number;
    }

    async setNotifLevel(user: Discord.User, level: string): Promise<boolean> {
        let rows = await query(`SELECT * FROM changelog_configuration WHERE id='${user.id}'`);
        if (!rows.length) await query(`INSERT INTO changelog_configuration (id, tag, level) VALUES ('${user.id}', '${user.tag}', '${level}')`);
        else await query(`UPDATE changelog_configuration SET level = '${level}' WHERE id = '${user.id}'`);
        await close();
        return true;
    }

    async getUser(discordID: string) {
        return this.users.get(discordID) || this.ensureUser(discordID);
    }

    async ensureUser(discordID: string) {
        let user: UserModel | null;
        user = await User.findOne({ id: discordID });

        if (!user) {
            user = new User({
                id: discordID
            });
        }

        let userEditable = new UserEditable(user);
        this.users.set(discordID, userEditable);

        return userEditable;
    }
}

export class UserEditable {
    user: UserModel;

    constructor(model: UserModel) {
        this.user = model;
    }

    getFeetPushed(): number {
        this.user.fun = this.user.fun || {
            payload: {
                feetPushed: 0,
                pushing: false,
                lastPushed: 0,
                pushedToday: 0,
                lastActiveDate: (new Date()).getDate()
            }
        };

        this.user.fun.payload = this.user.fun.payload || {
            feetPushed: 0,
            pushing: false,
            lastPushed: 0,
            pushedToday: 0,
            lastActiveDate: (new Date()).getDate()
        };

        return this.user.fun.payload.feetPushed || 0;
    }

    feetPushedTransaction(amount: number) {
        this.user.fun = this.user.fun || {
            payload: {
                feetPushed: 0,
                pushing: false,
                lastPushed: 0,
                pushedToday: 0,
                lastActiveDate: (new Date()).getDate()
            }
        };

        this.user.fun.payload = this.user.fun.payload || {
            feetPushed: 0,
            pushing: false,
            lastPushed: 0,
            pushedToday: 0,
            lastActiveDate: (new Date()).getDate()
        };

        this.user.fun.payload.feetPushed = this.user.fun.payload.feetPushed || 0;

        this.user.fun.payload.feetPushed += amount;
    }

    addCartFeet(feet: number): "SUCCESS" | "COOLDOWN" | "CAP" {
        this.user.fun = this.user.fun || {
            payload: {
                feetPushed: 0,
                pushing: false,
                lastPushed: 0,
                pushedToday: 0,
                lastActiveDate: (new Date()).getDate()
            }
        };

        this.user.fun.payload = this.user.fun.payload || {
            feetPushed: 0,
            pushing: false,
            lastPushed: 0,
            pushedToday: 0,
            lastActiveDate: (new Date()).getDate()
        };

        this.user.fun.payload.feetPushed = this.user.fun.payload.feetPushed || 0;
        this.user.fun.payload.pushedToday = this.user.fun.payload.pushedToday || 0;

        if (Date.now() - this.user.fun.payload.lastPushed < 1000 * 30) {
            return "COOLDOWN";
        } else if (this.user.fun.payload.pushedToday >= 1000) {
            if (this.user.fun.payload.lastActiveDate != (new Date()).getDate()) {
                this.user.fun.payload.pushedToday = 0;
            }
            else return "CAP";
        }

        this.user.fun.payload.feetPushed += feet;
        this.user.fun.payload.pushedToday += feet;
        this.user.fun.payload.lastPushed = Date.now();
        this.user.fun.payload.lastActiveDate = (new Date()).getDate();

        return "SUCCESS";
    }

    setProp(property: string, val: any) {
        const propertyChain = property.split(".");

        let currentProp: any = this.user;
        for (let i = 0; i < propertyChain.length; i++) {
            if (!currentProp[propertyChain[i]]) currentProp[propertyChain[i]] = {};
            else currentProp = currentProp[propertyChain[i]];
        }

        currentProp = val;
    }

    async refresh() {
        this.user = (await User.findOne({ id: this.user.id })) as UserModel;

        return this;
    }

    async save() {
        return await this.user.save();
    }
}