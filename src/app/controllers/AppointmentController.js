import { format, isBefore, parseISO, startOfHour, subHours } from 'date-fns';
import pt from 'date-fns/locale/pt-BR';
import * as Yup from 'yup';
import Mail from '../../lib/Mail';
import Appointment from '../models/Appointment';
import File from '../models/File';
import User from '../models/User';
import Notification from '../schemas/Notification';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      attributes: ['id', 'date'],
      limit: 20,
      offset: (page - 1) * 20,
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Schema validation fail' });
    }

    const { provider_id, date } = req.body;

    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    const isSameUser = provider_id === req.userId;

    if (isSameUser) {
      return res
        .status(401)
        .json({ error: 'You cannot schedule an appointment to yourself' });
    }

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only create an Appointment with Provider' });
    }

    const hourStart = startOfHour(parseISO(date));

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past date is not allowed' });
    }

    const isUnavailable = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (isUnavailable) {
      return res.status(400).json({ error: 'Date is not available' });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    /**
     * Notification
     */
    const user = await User.findByPk(req.userId);
    const formattedDate = format(hourStart, "'dia' dd 'de' MMMM' às' H:mm'h'", {
      locale: pt,
    });
    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formattedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id, {
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['name', 'email'],
        },
        {
          model: User,
          as: 'user',
          attributes: ['name'],
        },
      ],
    });

    if (appointment.user_id !== req.userId) {
      return res.status(400).json({
        error: 'You do not have permission to cancel this appointment',
      });
    }

    const dateWithSub = subHours(appointment.date, 2);

    if (isBefore(dateWithSub, new Date())) {
      return res.status(401).json({
        error: 'You can only cancel appointments 2 hours in advance',
      });
    }

    appointment.canceled_at = new Date();

    await appointment.save();

    await Mail.sendMail({
      to: `${appointment.provider.name} <${appointment.provider.email}> `,
      subject: 'Agendamento Cancelado',
      template: 'cancellation',
      context: {
        provider: appointment.provider.name,
        user: appointment.user.name,
        date: format(appointment.date, "'dia' dd 'de' MMMM' às' H:mm'h'", {
          locale: pt,
        }),
      },
    });

    return res.json(appointment);
  }
}

export default new AppointmentController();
