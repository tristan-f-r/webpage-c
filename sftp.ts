import Client from 'ssh2-sftp-client';
import fs from 'fs/promises';
import path from 'path';

// https://stackoverflow.com/questions/41462606/get-all-files-recursively-in-directories-nodejs
// i hate the js ecosystem.
async function* walk(dir: string): AsyncGenerator<string, undefined, undefined> {
	const files = await fs.readdir(dir, { withFileTypes: true });
	for (const file of files) {
		if (file.isDirectory()) {
			yield* walk(path.join(dir, file.name));
		} else {
			yield path.join(dir, file.name);
		}
	}
}

const config = {
	host: process.env.FTP_SERVER,
	username: process.env.FTP_USERNAME,
	password: process.env.FTP_PASSWORD
};

const sftp = new Client('sftp-client');

sftp
	.connect(config)
	.then(() => {
		return sftp.cwd();
	})
	.then(async (cwd) => {
		const walker = walk('build');
		for await (const file of walker) {
			// TODO: this logic is flimsy
			const newFile = file.substring(file.indexOf('/') + 1);

			console.log(`Creating directory on SFTP for ${newFile}..`);
			await sftp
				.mkdir(path.dirname(path.join(cwd, newFile)), true)
				.catch(() => console.error('An error occurred while making a directory'));

			console.log(`Creating file on SFTP for ${newFile}..`);
			await sftp
				.put(await fs.readFile(file), path.join(cwd, newFile))
				.catch(() => console.error('An error occurred while making a file'));
		}
		return sftp.end();
	})
	.catch(() => {
		console.log(`An error occurred.`);
	});
